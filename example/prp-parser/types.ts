/**
 * TypeScript interfaces and Zod schemas for PRP Parser MCP Server
 * These types define the structure of data throughout the application
 */

import { z } from "zod";

// User authentication props (inherited from OAuth)
export type Props = {
  login: string; // GitHub username
  name: string; // Display name
  email: string; // Email address
  accessToken: string; // GitHub access token
};

// Environment interface
export interface Env {
  DATABASE_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_PROVIDER: any;
  MCP_OBJECT: DurableObjectNamespace;
  AI?: any;
  SENTRY_DSN?: string;
  NODE_ENV?: string;
}

// Core data models
export interface PRP {
  id: string;
  name: string;
  description: string;
  goal: string;
  why: string[];
  what: string;
  successCriteria: string[];
  context: PRPContext;
  tasks: Task[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PRPContext {
  documentation: DocumentationRef[];
  codebaseTree: string;
  desiredTree: string;
  knownGotchas: string;
}

export interface DocumentationRef {
  type: "url" | "file" | "docfile";
  path: string;
  why: string;
  section?: string;
  critical?: string;
}

export interface Task {
  id: string;
  prpId: string;
  order: number;
  description: string;
  fileToModify?: string;
  pattern?: string;
  pseudocode?: string;
  status: "pending" | "in_progress" | "completed";
  additionalInfo: Record<string, any>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdBy: string;
  createdAt: Date;
}

// Zod schemas for validation
export const ParsePRPSchema = z.object({
  prpContent: z
    .string()
    .min(1, "PRP content cannot be empty")
    .max(50000, "PRP content exceeds maximum length")
    .describe("Markdown content of the PRP"),
  extractTasks: z.boolean().default(true).describe("Whether to extract tasks"),
  extractDocs: z.boolean().default(true).describe("Whether to extract documentation"),
  saveToDB: z.boolean().default(true).describe("Whether to save parsed PRP to database"),
});

export const CreateTaskSchema = z.object({
  prpId: z.string().uuid().describe("ID of the associated PRP"),
  description: z.string().min(1).max(1000).describe("Task description"),
  order: z.number().int().positive().describe("Task order"),
  fileToModify: z.string().optional().describe("File to modify for this task"),
  pattern: z.string().optional().describe("Code pattern to follow"),
  pseudocode: z.string().optional().describe("Pseudocode for implementation"),
  tags: z.array(z.string()).default([]).describe("Tags for the task"),
});

export const UpdateTaskSchema = z.object({
  id: z.string().uuid().describe("Task ID"),
  description: z.string().min(1).max(1000).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  additionalInfo: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export const DeleteTaskSchema = z.object({
  id: z.string().uuid().describe("Task ID"),
  hardDelete: z.boolean().default(false).describe("Whether to permanently delete or soft delete"),
});

export const GetTaskSchema = z.object({
  id: z.string().uuid().describe("Task ID"),
  includeTags: z.boolean().default(true).describe("Include associated tags"),
});

export const ListTasksSchema = z.object({
  prpId: z.string().uuid().optional().describe("Filter by PRP ID"),
  status: z.enum(["pending", "in_progress", "completed"]).optional().describe("Filter by status"),
  tags: z.array(z.string()).optional().describe("Filter by tags (any match)"),
  search: z.string().optional().describe("Search in description, pattern, and pseudocode"),
  includeDeleted: z.boolean().default(false).describe("Include soft-deleted tasks"),
  limit: z.number().int().positive().max(100).default(20).describe("Maximum results to return"),
  offset: z.number().int().min(0).default(0).describe("Offset for pagination"),
});

export const AddTaskInfoSchema = z.object({
  taskId: z.string().uuid().describe("Task ID"),
  info: z.record(z.any()).describe("Additional information to add/update"),
  merge: z.boolean().default(true).describe("Whether to merge with existing info or replace"),
});

export const CreateDocumentationSchema = z.object({
  prpId: z.string().uuid().describe("ID of the associated PRP"),
  type: z.enum(["url", "file", "docfile"]).describe("Type of documentation"),
  path: z.string().min(1).describe("Path or URL of the documentation"),
  why: z.string().optional().describe("Reason for including this documentation"),
  section: z.string().optional().describe("Specific section of the documentation"),
  critical: z.string().optional().describe("Critical information from this documentation"),
});

export const UpdateDocumentationSchema = z.object({
  id: z.string().uuid().describe("Documentation ID"),
  why: z.string().optional(),
  section: z.string().optional(),
  critical: z.string().optional(),
});

export const GetDocumentationSchema = z.object({
  prpId: z.string().uuid().optional().describe("Filter by PRP ID"),
  type: z.enum(["url", "file", "docfile"]).optional().describe("Filter by type"),
  limit: z.number().int().positive().max(100).default(50).describe("Maximum results"),
  offset: z.number().int().min(0).default(0).describe("Offset for pagination"),
});

export const CreateTagSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9-_]+$/, "Tag name must be alphanumeric with hyphens or underscores")
    .describe("Tag name"),
  description: z.string().max(500).optional().describe("Tag description"),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code")
    .optional()
    .describe("Tag color in hex format"),
});

export const TagItemSchema = z.object({
  itemId: z.string().uuid().describe("ID of the item to tag"),
  itemType: z.enum(["task", "prp"]).describe("Type of item to tag"),
  tagNames: z.array(z.string()).min(1).describe("Tag names to apply"),
});

export const RemoveTagSchema = z.object({
  itemId: z.string().uuid().describe("ID of the item"),
  itemType: z.enum(["task", "prp"]).describe("Type of item"),
  tagName: z.string().describe("Tag name to remove"),
});

export const SearchByTagSchema = z.object({
  tagNames: z.array(z.string()).min(1).describe("Tag names to search for"),
  itemType: z.enum(["task", "prp", "all"]).default("all").describe("Type of items to search"),
  matchAll: z.boolean().default(false).describe("Whether all tags must match or any"),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const SearchPRPsSchema = z.object({
  query: z.string().optional().describe("Full-text search query"),
  createdBy: z.string().optional().describe("Filter by creator"),
  tags: z.array(z.string()).optional().describe("Filter by tags"),
  fromDate: z.string().datetime().optional().describe("Filter by creation date (from)"),
  toDate: z.string().datetime().optional().describe("Filter by creation date (to)"),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Result types
export interface ParsedPRP {
  name: string;
  description: string;
  goal: string;
  why: string[];
  what: string;
  successCriteria: string[];
  context: {
    documentation: DocumentationRef[];
    codebaseTree: string;
    desiredTree: string;
    knownGotchas: string;
  };
  tasks: Array<{
    order: number;
    description: string;
    fileToModify?: string;
    pattern?: string;
    pseudocode?: string;
  }>;
}

// Error types
export class PRPParseError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "PRPParseError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public errors?: any[]) {
    super(message);
    this.name = "ValidationError";
  }
}

// Helper function for creating MCP-compatible error responses
export function createErrorResponse(message: string, details?: any): any {
  return {
    content: [
      {
        type: "text",
        text:
          `**Error**\n\n${message}` +
          (details ? `\n\n**Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`` : ""),
        isError: true,
      },
    ],
  };
}

// Helper function for creating MCP-compatible success responses
export function createSuccessResponse(message: string, data?: any): any {
  return {
    content: [
      {
        type: "text",
        text:
          `**Success**\n\n${message}` +
          (data ? `\n\n**Result:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` : ""),
      },
    ],
  };
}