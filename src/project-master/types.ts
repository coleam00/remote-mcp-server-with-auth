/**
 * TypeScript interfaces and Zod schemas for Project Master MCP Server
 * This file contains all types, interfaces, and validation schemas used throughout the application
 */

import { z } from "zod";
import {
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  ProjectRole,
  Project,
  Task,
  ProjectMember,
  ProjectAnalytics,
  TaskGenerationConfig,
  AITask,
  PaginatedResult,
} from "./database/schema";

// Re-export database types for convenience
export {
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  ProjectRole,
} from "./database/schema";

export type {
  Project,
  Task,
  ProjectMember,
  ProjectAnalytics,
  TaskGenerationConfig,
  AITask,
  PaginatedResult,
} from "./database/schema";

// User authentication props (inherited from OAuth)
export type Props = {
  login: string; // GitHub username
  name: string; // Display name
  email: string; // Email address
  accessToken: string; // GitHub access token
};

// Environment interface for Cloudflare Workers
export interface Env {
  DATABASE_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: DurableObjectNamespace;
  COOKIE_ENCRYPTION_KEY: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL?: string; // Optional model override (defaults to claude-3-haiku-20240307)
  AI_MODEL_ENDPOINT?: string; // Optional custom AI endpoint
  SENTRY_DSN?: string;
  NODE_ENV?: string;
  MCP_OBJECT: DurableObjectNamespace;
  AI?: any; // Cloudflare AI binding
}

// Zod schemas for tool validation
export const ProjectInitSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Project name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  prpContent: z.string().optional().describe("Product Requirements Prompt content for AI coding assistants"),
  context: z.record(z.any()).optional().describe("Additional project context")
});

export const ProjectListSchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional().describe("Filter projects by status"),
  limit: z.number().int().positive().max(50).default(10).describe("Maximum number of projects to return")
});

export const ProjectGetSchema = z.object({
  projectId: z.string().uuid().describe("Project UUID")
});

export const TaskCreateSchema = z.object({
  projectId: z.string().uuid().describe("Project UUID"),
  title: z.string().min(1, "Task title is required").max(200, "Task title must be 200 characters or less"),
  description: z.string().max(2000, "Description must be 2000 characters or less").optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM).describe("Task priority"),
  dependencies: z.array(z.string().uuid()).optional().describe("Array of task UUIDs this task depends on"),
  assignee: z.string().optional().describe("GitHub username of assignee"),
  estimatedHours: z.number().positive().optional().describe("Estimated hours to complete")
});

export const TaskListSchema = z.object({
  projectId: z.string().uuid().describe("Project UUID"),
  status: z.nativeEnum(TaskStatus).optional().describe("Filter tasks by status"),
  priority: z.nativeEnum(TaskPriority).optional().describe("Filter tasks by priority"),
  assignee: z.string().optional().describe("Filter tasks by assignee"),
  limit: z.number().int().positive().max(100).default(20).describe("Maximum number of tasks to return"),
  offset: z.number().int().min(0).default(0).describe("Offset for pagination")
});

export const TaskGetSchema = z.object({
  taskId: z.string().uuid().describe("Task UUID")
});

export const TaskUpdateSchema = z.object({
  taskId: z.string().uuid().describe("Task UUID to update"),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignee: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().min(0).optional(),
  notes: z.string().max(1000).optional()
});

export const TaskCompleteSchema = z.object({
  taskId: z.string().uuid().describe("Task UUID to complete"),
  actualHours: z.number().positive().optional().describe("Actual hours spent on task"),
  notes: z.string().max(1000).optional().describe("Completion notes")
});

export const TaskNextSchema = z.object({
  projectId: z.string().uuid().describe("Project UUID"),
  excludeBlocked: z.boolean().default(false).describe("Whether to exclude blocked tasks")
});

export const ParsePRPSchema = z.object({
  projectId: z.string().uuid().describe("Project UUID"),
  prpContent: z.string().min(1, "PRP content is required").describe("Product Requirements Prompt content to parse for AI coding assistants"),
  generateMilestones: z.boolean().default(true).describe("Whether to generate project milestones with validation gates"),
  maxTasks: z.number().int().positive().max(100).default(20).describe("Maximum number of implementation tasks to generate"),
  overwriteExisting: z.boolean().default(false).describe("Whether to overwrite existing tasks")
});

export const ProjectResearchSchema = z.object({
  projectId: z.string().uuid().describe("Project UUID"),
  query: z.string().min(1, "Research query is required").max(500, "Query must be 500 characters or less"),
  includeContext: z.boolean().default(true).describe("Whether to include project context in research"),
  maxResults: z.number().int().positive().max(10).default(5).describe("Maximum number of research results")
});

export const ProjectContextSchema = z.object({
  projectId: z.string().uuid().describe("Project UUID"),
  context: z.record(z.any()).optional().describe("Project context to update"),
  append: z.boolean().default(false).describe("Whether to append to existing context or replace")
});

// API response types
export type MCPResponse = {
  content: Array<{
    type: "text";
    text: string;
    isError?: boolean;
  }>;
};

export type MCPError = {
  content: Array<{
    type: "text";
    text: string;
    isError: true;
  }>;
};

// Utility types for type inference
export type CreateProjectData = z.infer<typeof ProjectInitSchema>;
export type ListProjectsData = z.infer<typeof ProjectListSchema>;
export type GetProjectData = z.infer<typeof ProjectGetSchema>;
export type CreateTaskData = z.infer<typeof TaskCreateSchema>;
export type ListTasksData = z.infer<typeof TaskListSchema>;
export type GetTaskData = z.infer<typeof TaskGetSchema>;
export type UpdateTaskData = z.infer<typeof TaskUpdateSchema>;
export type CompleteTaskData = z.infer<typeof TaskCompleteSchema>;
export type NextTaskData = z.infer<typeof TaskNextSchema>;
export type ParsePRPData = z.infer<typeof ParsePRPSchema>;
export type ProjectResearchData = z.infer<typeof ProjectResearchSchema>;
export type ProjectContextData = z.infer<typeof ProjectContextSchema>;

// AI Service types
export interface AIResearchResult {
  title: string;
  summary: string;
  relevance: number;
  source?: string;
  url?: string;
}

// Validation helper types
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type PermissionResult = {
  hasPermission: boolean;
  reason?: string;
};

// Task dependency graph for analysis
export interface TaskDependencyGraph {
  [taskId: string]: {
    task: Task;
    dependencies: string[];
    dependents: string[];
    level: number;
  };
}

// Export all schemas for easy import
export const Schemas = {
  ProjectInit: ProjectInitSchema,
  ProjectList: ProjectListSchema,
  ProjectGet: ProjectGetSchema,
  TaskCreate: TaskCreateSchema,
  TaskList: TaskListSchema,
  TaskGet: TaskGetSchema,
  TaskUpdate: TaskUpdateSchema,
  TaskComplete: TaskCompleteSchema,
  TaskNext: TaskNextSchema,
  ParsePRP: ParsePRPSchema,
  ProjectResearch: ProjectResearchSchema,
  ProjectContext: ProjectContextSchema,
} as const;

// Error types
export class ProjectMasterError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "ProjectMasterError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public errors?: any[]) {
    super(message);
    this.name = "ValidationError";
  }
}

export class PermissionError extends Error {
  constructor(message: string, public userId?: string) {
    super(message);
    this.name = "PermissionError";
  }
}

// Helper functions for creating MCP-compatible responses
export function createErrorResponse(message: string, details?: any): MCPError {
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

export function createSuccessResponse(message: string, data?: any): MCPResponse {
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

// Constants
export const DEFAULT_ANTHROPIC_MODEL = "claude-3-haiku-20240307";
export const ALLOWED_USERNAMES = new Set<string>(["coleam00"]); // Users with write permissions