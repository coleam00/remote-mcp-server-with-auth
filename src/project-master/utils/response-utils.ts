/**
 * Response utility functions for MCP tools
 * Standardized response creation and formatting
 */

import { MCPResponse, MCPError } from "../types";

/**
 * Creates a standardized error response
 */
export function createErrorResponse(message: string, details?: any): MCPError {
  return {
    content: [{
      type: "text" as const,
      text: `**Error**\n\n${message}${details ? `\n\n**Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`` : ''}`,
      isError: true
    }]
  };
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(message: string, data?: any): MCPResponse {
  return {
    content: [{
      type: "text" as const,
      text: `**Success**\n\n${message}${data ? `\n\n**Data:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` : ''}`
    }]
  };
}

/**
 * Creates a standardized information response
 */
export function createInfoResponse(title: string, content: string, data?: any): MCPResponse {
  return {
    content: [{
      type: "text" as const,
      text: `**${title}**\n\n${content}${data ? `\n\n**Data:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` : ''}`
    }]
  };
}

/**
 * Creates a list response for multiple items
 */
export function createListResponse(
  title: string, 
  items: any[], 
  formatter: (item: any, index: number) => string,
  pagination?: { total: number; limit: number; offset: number; hasMore: boolean }
): MCPResponse {
  const formattedItems = items.map((item, index) => formatter(item, index)).join('\n\n');
  
  let paginationText = '';
  if (pagination) {
    paginationText = `\n\n**Pagination:**\n- Showing ${items.length} of ${pagination.total} items\n- Page: ${Math.floor(pagination.offset / pagination.limit) + 1}\n- Has more: ${pagination.hasMore ? 'Yes' : 'No'}`;
  }
  
  return {
    content: [{
      type: "text" as const,
      text: `**${title}** (${items.length}${pagination ? ` of ${pagination.total}` : ''})

${formattedItems}${paginationText}`
    }]
  };
}

/**
 * Creates a detailed item response with metadata
 */
export function createDetailResponse(
  title: string,
  item: any,
  formatter: (item: any) => string,
  actions?: string[]
): MCPResponse {
  const actionsText = actions && actions.length > 0 ? 
    `\n\n**Available Actions:**\n${actions.map(action => `- ${action}`).join('\n')}` : '';
  
  return {
    content: [{
      type: "text" as const,
      text: `${formatter(item)}${actionsText}`
    }]
  };
}

/**
 * Creates a help response for tools
 */
export function createHelpResponse(toolName: string, description: string, examples: string[]): MCPResponse {
  const examplesText = examples.length > 0 ? 
    `\n\n**Examples:**\n${examples.map(example => `- ${example}`).join('\n')}` : '';
  
  return {
    content: [{
      type: "text" as const,
      text: `**${toolName} Help**

${description}${examplesText}`
    }]
  };
}

/**
 * Creates a validation error response with field-specific errors
 */
export function createValidationErrorResponse(errors: Record<string, string[]>): MCPError {
  const errorText = Object.entries(errors)
    .map(([field, fieldErrors]) => `**${field}:**\n${fieldErrors.map(err => `  - ${err}`).join('\n')}`)
    .join('\n\n');
  
  return {
    content: [{
      type: "text" as const,
      text: `**Validation Error**\n\n${errorText}`,
      isError: true
    }]
  };
}

/**
 * Creates a permission denied response
 */
export function createPermissionDeniedResponse(resource: string, requiredPermission?: string): MCPError {
  return {
    content: [{
      type: "text" as const,
      text: `**Permission Denied**\n\nYou don't have permission to access ${resource}.${requiredPermission ? `\n\nRequired permission: ${requiredPermission}` : ''}`,
      isError: true
    }]
  };
}

/**
 * Creates a not found response
 */
export function createNotFoundResponse(resource: string, id?: string): MCPError {
  return {
    content: [{
      type: "text" as const,
      text: `**Not Found**\n\n${resource}${id ? ` with ID "${id}"` : ''} was not found.`,
      isError: true
    }]
  };
}

/**
 * Creates a rate limit response
 */
export function createRateLimitResponse(limit: number, resetTime?: Date): MCPError {
  const resetText = resetTime ? `\n\nRate limit resets at: ${resetTime.toISOString()}` : '';
  
  return {
    content: [{
      type: "text" as const,
      text: `**Rate Limit Exceeded**\n\nYou have exceeded the rate limit of ${limit} requests.${resetText}`,
      isError: true
    }]
  };
}