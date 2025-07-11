/**
 * MCP Server mocking utilities for testing
 * Provides mock implementations for McpServer and related components
 */

import { vi } from 'vitest';

// Mock MCP Server
export function createMockMcpServer() {
  const registeredTools = new Map();

  const mockServer = {
    tool: vi.fn().mockImplementation((name: string, description: string, schema: any, handler: Function) => {
      registeredTools.set(name, {
        name,
        description,
        schema,
        handler
      });
    }),
    
    // Helper to get registered tools for testing
    getRegisteredTools: () => registeredTools,
    
    // Helper to call a tool handler for testing
    callTool: async (name: string, args: any) => {
      const tool = registeredTools.get(name);
      if (!tool) {
        throw new Error(`Tool '${name}' not registered`);
      }
      return await tool.handler(args);
    }
  };

  return mockServer;
}

// Mock environment variables
export function createMockEnv(overrides: Partial<any> = {}) {
  return {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    GITHUB_CLIENT_ID: 'test_client_id',
    GITHUB_CLIENT_SECRET: 'test_client_secret',
    COOKIE_ENCRYPTION_KEY: 'test_encryption_key',
    ANTHROPIC_API_KEY: 'test_anthropic_key',
    ANTHROPIC_MODEL: 'claude-3-haiku-20240307',
    NODE_ENV: 'test',
    ...overrides
  };
}

// Mock user props (authenticated GitHub user)
export function createMockProps(overrides: Partial<any> = {}) {
  return {
    login: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    accessToken: 'test_github_token',
    ...overrides
  };
}

// Mock privileged user props
export function createMockPrivilegedProps(overrides: Partial<any> = {}) {
  return {
    login: 'coleam00', // This user is in ALLOWED_USERNAMES
    name: 'Cole (Privileged)',
    email: 'cole@example.com',
    accessToken: 'test_privileged_token',
    ...overrides
  };
}

// Mock tool response utilities
export const mockResponses = {
  success: (message: string, data?: any) => ({
    content: [{
      type: 'text',
      text: `**Success**\n\n${message}${data ? `\n\n**Details:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` : ''}`
    }]
  }),

  error: (message: string, details?: any) => ({
    content: [{
      type: 'text',
      text: `**Error**\n\n${message}${details ? `\n\n**Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`` : ''}`,
      isError: true
    }]
  }),

  info: (title: string, content: string, details?: any) => ({
    content: [{
      type: 'text',
      text: `**${title}**\n\n${content}${details ? `\n\n**Additional Info:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`` : ''}`
    }]
  }),

  list: (title: string, items: any[], formatter: Function) => ({
    content: [{
      type: 'text',
      text: `**${title}**\n\n${items.map((item, index) => formatter(item, index)).join('\n\n')}`
    }]
  })
};

// Mock ALLOWED_USERNAMES for testing
export const mockAllowedUsernames = new Set(['coleam00', 'testprivileged']);

// Helper to mock tool registration functions
export function createMockToolRegistration() {
  return {
    registerProjectTools: vi.fn(),
    registerPRPTools: vi.fn(),
    registerTaskTools: vi.fn(),
    registerResearchTools: vi.fn()
  };
}