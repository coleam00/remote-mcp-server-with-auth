---
name: "Project Master MCP Server"
description: An AI-powered project and task management MCP server for managing AI coding projects, inspired by Claude Task Master, with GitHub OAuth authentication and PostgreSQL database integration.
---

## Purpose

Create a production-ready Model Context Protocol (MCP) server that provides intelligent project and task management capabilities for AI coding projects. This server will enable AI assistants to help developers break down Product Requirements Prompts (PRPs) into actionable tasks, track project progress, and provide contextual research support throughout the development lifecycle.

## Core Principles

1. **Context is King**: Include all necessary patterns for project management, task tracking, and AI-assisted development workflows
2. **Validation Loops**: Provide executable tests from TypeScript compilation to production deployment
3. **Security First**: Build-in authentication, authorization, and data protection for project information
4. **Production Ready**: Include monitoring, error handling, and deployment automation
5. **AI-Native Workflow**: Design tools that work seamlessly with AI assistants to enhance developer productivity

---

## Goal

Build a production-ready MCP (Model Context Protocol) server with:

- **Project Management**: Initialize and manage AI coding projects with structured workflows
- **Task Generation**: Parse PRPs and generate actionable development tasks with AI assistance
- **Task Tracking**: List, prioritize, and track progress on project tasks
- **Intelligent Assistance**: Identify next tasks and provide contextual research capabilities
- **Project Context**: Maintain project-specific context for better AI assistance
- GitHub OAuth authentication with role-based access control
- PostgreSQL database integration for persistent project and task storage
- Cloudflare Workers deployment with monitoring

## Why

- **Developer Productivity**: Enable AI assistants to manage complex project workflows and task breakdowns
- **Context Preservation**: Maintain project context across AI interactions for better assistance
- **Enterprise Security**: GitHub OAuth ensures only authorized users can access project data
- **Scalability**: Cloudflare Workers enables global edge deployment for team collaboration
- **Workflow Standardization**: Provides a consistent approach to AI-assisted software development

## What

### MCP Server Features

**Core MCP Tools:**

- `project-init` - Initialize a new AI coding project with metadata and configuration
- `project-list` - List all projects for the authenticated user
- `project-get` - Get detailed information about a specific project
- `parse-prp` - Parse a Product Requirements Prompt and generate actionable tasks
- `task-list` - List all tasks for a project with filtering and sorting options
- `task-get` - Get detailed information about a specific task
- `task-create` - Create a new task manually
- `task-update` - Update task status, priority, or details
- `task-next` - Intelligently identify the next task to work on based on dependencies and priority
- `task-complete` - Mark a task as completed with notes
- `project-research` - Conduct contextual research with project-specific information
- `project-context` - Get or update the project context for AI assistance

**Authentication & Authorization:**

- GitHub OAuth 2.0 integration with signed cookie approval system
- User-specific project isolation (users can only see their own projects)
- Optional team/organization support for shared projects
- Secure session management with HMAC-signed cookies

**Database Schema:**

- **Projects Table**: id, user_id, name, description, prd_content, context, created_at, updated_at
- **Tasks Table**: id, project_id, title, description, status, priority, dependencies, assignee, created_at, updated_at, completed_at
- **Project Members Table**: project_id, user_id, role, added_at (for team features)
- PostgreSQL with proper indexing for performance

**Deployment & Monitoring:**

- Cloudflare Workers with Durable Objects for state management
- Optional Sentry integration for error tracking and performance monitoring
- Environment-based configuration (development vs production)
- Real-time logging for debugging and auditing

### Success Criteria

- [ ] MCP server passes validation with MCP Inspector
- [ ] GitHub OAuth flow works end-to-end (authorization → callback → MCP access)
- [ ] Project initialization creates proper database records
- [ ] PRD parsing generates meaningful, actionable tasks
- [ ] Task management operations (CRUD) work correctly with proper validation
- [ ] Task prioritization and dependency tracking functions properly
- [ ] Project context is maintained and retrievable across sessions
- [ ] TypeScript compilation succeeds with no errors
- [ ] Local development server starts and responds correctly
- [ ] Production deployment to Cloudflare Workers succeeds
- [ ] Authentication prevents unauthorized access to other users' projects
- [ ] Error handling provides user-friendly messages without leaking system details

## All Needed Context

### Documentation & References (MUST READ)

```yaml
# CRITICAL MCP PATTERNS - Read these first
- docfile: PRPs/ai_docs/mcp_patterns.md
  why: Core MCP development patterns, security practices, and error handling

# EXISTING CODEBASE PATTERNS - Study these implementations as strong examples
- file: src/index.ts
  why: Complete MCP server with authentication, database, and tools - MIRROR this pattern

- file: src/github-handler.ts
  why: OAuth flow implementation - USE this exact pattern for authentication

- file: src/database.ts
  why: Database security, connection pooling, SQL validation - FOLLOW these patterns

- file: src/simple-math.ts
  why: Basic MCP server without auth - good starting point for tool registration

- file: wrangler.jsonc
  why: Cloudflare Workers configuration - COPY this pattern for deployment

# OFFICIAL MCP DOCUMENTATION
- url: https://modelcontextprotocol.io/docs/concepts/tools
  why: MCP tool registration and schema definition patterns

- url: https://modelcontextprotocol.io/docs/concepts/resources
  why: MCP resource implementation for project data access

# TASK MANAGEMENT INSPIRATION
- url: https://github.com/eyaltoledano/claude-task-master
  why: Reference implementation for task management patterns and AI workflow integration
```

### Current Codebase Tree (Run `tree -I node_modules` in project root)

```bash
/
├── src/
│   ├── index.ts                 # Main authenticated MCP server ← STUDY THIS
│   ├── index_sentry.ts         # Sentry monitoring version
│   ├── simple-math.ts          # Basic MCP example ← GOOD STARTING POINT
│   ├── github-handler.ts       # OAuth implementation ← USE THIS PATTERN
│   ├── database.ts             # Database utilities ← SECURITY PATTERNS
│   ├── utils.ts                # OAuth helpers
│   └── workers-oauth-utils.ts  # Cookie security system
├── PRPs/
│   ├── templates/prp_mcp_base.md  # Base template
│   ├── prp_project_master_mcp.md  # This PRP
│   └── ai_docs/                   # Implementation guides ← READ ALL
├── wrangler.jsonc              # Cloudflare config ← COPY PATTERNS
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

### Desired Codebase Tree (Files to add/modify)

```bash
/
├── src/
│   ├── project-master.ts       # NEW: Main project management MCP server
│   ├── project-types.ts        # NEW: TypeScript interfaces and Zod schemas
│   └── project-utils.ts        # NEW: Project/task management utilities
├── wrangler-project-master.jsonc  # NEW: Cloudflare config for project master
├── migrations/
│   └── 001_project_schema.sql  # NEW: Database schema for projects/tasks
└── .dev.vars                   # UPDATE: Add project-specific env vars
```

### Known Gotchas & Critical MCP/Cloudflare Patterns

```typescript
// CRITICAL: Cloudflare Workers require specific patterns
// 1. ALWAYS implement cleanup for Durable Objects
export class ProjectMasterMCP extends McpAgent<Env, Record<string, never>, Props> {
  async cleanup(): Promise<void> {
    await closeDb(); // CRITICAL: Close database connections
  }

  async alarm(): Promise<void> {
    await this.cleanup(); // CRITICAL: Handle Durable Object alarms
  }
}

// 2. ALWAYS validate SQL to prevent injection (use existing patterns)
const validation = validateSqlQuery(sql); // from src/database.ts
if (!validation.isValid) {
  return createErrorResponse(validation.error);
}

// 3. User isolation pattern for multi-tenant data
const userId = this.props.login; // GitHub username
const projectQuery = `SELECT * FROM projects WHERE user_id = $1`;
const results = await db(projectQuery, [userId]); // Parameterized query

// 4. Task dependency validation
function validateTaskDependencies(taskId: string, dependencies: string[]): boolean {
  // Ensure no circular dependencies
  // Verify all dependencies exist in the same project
  return true;
}

// 5. PRD parsing pattern with AI assistance
async function parsePRD(prdContent: string, projectContext: any): Promise<Task[]> {
  // Use structured prompting to extract tasks
  // Validate generated tasks against schema
  // Ensure task relationships are maintained
  return tasks;
}

// 6. TypeScript compilation requires exact interface matching
interface Env {
  DATABASE_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: DurableObjectNamespace;
  COOKIE_ENCRYPTION_KEY: string;
  ANTHROPIC_API_KEY: string; // Required for PRD parsing
  // Add project-specific environment variables
  AI_MODEL_ENDPOINT?: string; // Optional custom AI endpoint
}
```

## Implementation Blueprint

### Data Models & Types

Define TypeScript interfaces and Zod schemas for type safety and validation.

```typescript
// project-types.ts
import { z } from "zod";

// User authentication props (inherited from OAuth)
type Props = {
  login: string; // GitHub username
  name: string; // Display name
  email: string; // Email address
  accessToken: string; // GitHub access token
};

// Project status enum
export enum ProjectStatus {
  PLANNING = "planning",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  ARCHIVED = "archived"
}

// Task status enum
export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  BLOCKED = "blocked",
  IN_REVIEW = "in_review",
  DONE = "done"
}

// Task priority enum
export enum TaskPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

// Zod schemas for validation
export const ProjectInitSchema = z.object({
  name: z.string().min(1).max(100).describe("Project name"),
  description: z.string().max(500).describe("Project description"),
  prdContent: z.string().optional().describe("Product Requirements Document content"),
  context: z.object({}).optional().describe("Additional project context")
});

export const TaskCreateSchema = z.object({
  projectId: z.string().uuid().describe("Project ID"),
  title: z.string().min(1).max(200).describe("Task title"),
  description: z.string().max(2000).describe("Task description"),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dependencies: z.array(z.string().uuid()).optional().describe("Task IDs this task depends on"),
  estimatedHours: z.number().positive().optional().describe("Estimated hours to complete")
});

export const TaskUpdateSchema = z.object({
  taskId: z.string().uuid().describe("Task ID to update"),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignee: z.string().optional(),
  notes: z.string().max(1000).optional()
});

export const ParsePRDSchema = z.object({
  projectId: z.string().uuid().describe("Project ID"),
  prdContent: z.string().min(1).describe("PRD content to parse"),
  generateMilestones: z.boolean().default(true).describe("Generate project milestones"),
  maxTasks: z.number().int().positive().max(100).default(20).describe("Maximum tasks to generate")
});

// Database models
export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  prdContent?: string;
  context?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies?: string[];
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Environment interface
interface Env {
  DATABASE_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: DurableObjectNamespace;
  COOKIE_ENCRYPTION_KEY: string;
  ANTHROPIC_API_KEY: string; // Required for PRD parsing and AI features
  AI_MODEL_ENDPOINT?: string; // Optional custom endpoint
  SENTRY_DSN?: string; // Optional monitoring
}
```

### List of Tasks (Complete in order)

```yaml
Task 1 - Project Setup:
  COPY wrangler.jsonc to wrangler-project-master.jsonc:
    - MODIFY name field to "project-master-mcp"
    - KEEP all existing OAuth and database configuration
    - ADD any AI service endpoints to vars section if needed

  UPDATE .dev.vars file:
    - KEEP existing OAuth credentials
    - ADD ANTHROPIC_API_KEY=sk-ant-... (required for PRD parsing)
    - ADD AI_MODEL_ENDPOINT if using custom endpoint
    - ENSURE DATABASE_URL points to PostgreSQL instance

Task 2 - Database Schema:
  CREATE migrations/001_project_schema.sql:
    - CREATE projects table with user isolation
    - CREATE tasks table with proper relationships
    - CREATE indexes for performance (user_id, project_id, status)
    - ADD created_at/updated_at triggers

  RUN migration against database:
    - CONNECT to PostgreSQL instance
    - EXECUTE migration script
    - VERIFY tables created successfully

Task 3 - Type Definitions:
  CREATE src/project-types.ts:
    - COPY type definitions from blueprint above
    - EXPORT all interfaces, enums, and Zod schemas
    - ENSURE proper imports from zod

  CREATE src/project-utils.ts:
    - IMPLEMENT task dependency validation
    - IMPLEMENT PRD parsing utilities
    - IMPLEMENT task prioritization logic
    - ADD project context management helpers

Task 4 - MCP Server Implementation:
  CREATE src/project-master.ts:
    - COPY class structure from src/index.ts
    - MODIFY server name to "Project Master MCP"
    - IMPLEMENT all project management tools
    - ENSURE proper user isolation in queries

  IMPLEMENT Core Tools:
    - project-init: Create new project with validation
    - project-list: Query user's projects with pagination
    - parse-prp: Generate tasks from PRP content
    - task-list: Query tasks with filtering/sorting
    - task-next: Algorithm to identify next task
    - task-update: Update task with validation

Task 5 - Authentication Integration:
  REUSE existing OAuth patterns:
    - IMPORT GitHubHandler from src/github-handler.ts
    - USE existing cookie approval system
    - ENSURE user isolation in all database queries

  ADD project-specific permissions:
    - CHECK project ownership before operations
    - IMPLEMENT optional team/sharing features
    - LOG all project access for auditing

Task 6 - Testing & Validation:
  TEST with MCP Inspector:
    - RUN: npx @modelcontextprotocol/inspector
    - VERIFY all tools appear correctly
    - TEST each tool with sample data

  TEST OAuth flow:
    - START: wrangler dev --config wrangler-project-master.jsonc
    - NAVIGATE to http://localhost:8788/authorize
    - COMPLETE GitHub authentication
    - VERIFY MCP endpoint accessible

Task 7 - Production Deployment:
  PREPARE production environment:
    - SET production secrets with wrangler:
      - wrangler secret put GITHUB_CLIENT_ID
      - wrangler secret put GITHUB_CLIENT_SECRET  
      - wrangler secret put DATABASE_URL
      - wrangler secret put COOKIE_ENCRYPTION_KEY
      - wrangler secret put ANTHROPIC_API_KEY
    - VERIFY database connectivity
    - UPDATE GitHub OAuth app callback URL

  DEPLOY to Cloudflare:
    - RUN: wrangler deploy --config wrangler-project-master.jsonc
    - TEST production OAuth flow
    - VERIFY all tools work in production
    - MONITOR logs for any issues
```

### Per Task Implementation Details

```typescript
// Task 4 - Core MCP Server Implementation
// src/project-master.ts

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { GitHubHandler } from "./github-handler";
import { closeDb } from "./database";
import { withDatabase, validateSqlQuery, formatDatabaseError } from "./database";
import { 
  ProjectInitSchema, 
  TaskCreateSchema, 
  TaskUpdateSchema,
  ParsePRDSchema,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  type Project,
  type Task
} from "./project-types";

export class ProjectMasterMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "Project Master MCP",
    version: "1.0.0",
  });

  // CRITICAL: Always implement cleanup
  async cleanup(): Promise<void> {
    try {
      await closeDb();
      console.log("Database connections closed successfully");
    } catch (error) {
      console.error("Error during database cleanup:", error);
    }
  }

  async alarm(): Promise<void> {
    await this.cleanup();
  }

  async init() {
    console.log(`Project Master MCP initialized for user: ${this.props.login}`);
    
    // Register all project management tools
    this.registerProjectTools();
    this.registerTaskTools();
    this.registerAnalyticsTools();
  }

  private registerProjectTools() {
    // Initialize new project
    this.server.tool(
      "project-init",
      "Initialize a new AI coding project with metadata and configuration",
      ProjectInitSchema,
      async ({ name, description, prdContent, context }) => {
        try {
          return await withDatabase(this.env.DATABASE_URL, async (db) => {
            // Check for duplicate project name for this user
            const existing = await db`
              SELECT id FROM projects 
              WHERE user_id = ${this.props.login} 
              AND name = ${name}
            `;
            
            if (existing.length > 0) {
              return {
                content: [{
                  type: "text",
                  text: `A project named "${name}" already exists for your account.`,
                  isError: true
                }]
              };
            }

            // Create new project
            const [project] = await db`
              INSERT INTO projects (
                user_id, name, description, status, prd_content, context
              ) VALUES (
                ${this.props.login},
                ${name},
                ${description},
                ${ProjectStatus.PLANNING},
                ${prdContent || null},
                ${JSON.stringify(context || {})}
              )
              RETURNING *
            `;

            return {
              content: [{
                type: "text",
                text: `**Project Created Successfully**\n\n**ID:** ${project.id}\n**Name:** ${name}\n**Status:** ${project.status}\n\nNext steps:\n1. Use \`parse-prp\` to generate tasks from your PRP\n2. Use \`task-list\` to view generated tasks\n3. Use \`task-next\` to identify what to work on first`
              }]
            };
          });
        } catch (error) {
          console.error('Project initialization error:', error);
          return {
            content: [{
              type: "text",
              text: `Failed to create project: ${formatDatabaseError(error)}`,
              isError: true
            }]
          };
        }
      }
    );

    // List user's projects
    this.server.tool(
      "project-list",
      "List all projects for the authenticated user with filtering options",
      {
        status: z.nativeEnum(ProjectStatus).optional(),
        limit: z.number().int().positive().max(50).default(10)
      },
      async ({ status, limit }) => {
        try {
          return await withDatabase(this.env.DATABASE_URL, async (db) => {
            const query = status
              ? db`SELECT * FROM projects WHERE user_id = ${this.props.login} AND status = ${status} ORDER BY updated_at DESC LIMIT ${limit}`
              : db`SELECT * FROM projects WHERE user_id = ${this.props.login} ORDER BY updated_at DESC LIMIT ${limit}`;
            
            const projects = await query;

            if (projects.length === 0) {
              return {
                content: [{
                  type: "text",
                  text: "No projects found. Use `project-init` to create your first project."
                }]
              };
            }

            const projectList = projects.map((p: Project) => 
              `- **${p.name}** (${p.id})\n  Status: ${p.status}\n  Created: ${new Date(p.createdAt).toLocaleDateString()}`
            ).join('\n\n');

            return {
              content: [{
                type: "text",
                text: `**Your Projects (${projects.length})**\n\n${projectList}`
              }]
            };
          });
        } catch (error) {
          console.error('Project listing error:', error);
          return {
            content: [{
              type: "text",
              text: `Failed to list projects: ${formatDatabaseError(error)}`,
              isError: true
            }]
          };
        }
      }
    );

    // Parse PRD to generate tasks
    this.server.tool(
      "parse-prp",
      "Parse a Product Requirements Document and generate actionable development tasks",
      ParsePRDSchema,
      async ({ projectId, prdContent, generateMilestones, maxTasks }) => {
        try {
          return await withDatabase(this.env.DATABASE_URL, async (db) => {
            // Verify project ownership
            const [project] = await db`
              SELECT * FROM projects 
              WHERE id = ${projectId} 
              AND user_id = ${this.props.login}
            `;

            if (!project) {
              return {
                content: [{
                  type: "text",
                  text: "Project not found or access denied.",
                  isError: true
                }]
              };
            }

            // Update project with PRD content
            await db`
              UPDATE projects 
              SET prd_content = ${prdContent}, 
                  updated_at = NOW() 
              WHERE id = ${projectId}
            `;

            // Generate tasks from PRD (simplified version)
            const tasks = await this.generateTasksFromPRD(prdContent, project, maxTasks);

            // Insert generated tasks
            for (const task of tasks) {
              await db`
                INSERT INTO tasks (
                  project_id, title, description, status, priority
                ) VALUES (
                  ${projectId},
                  ${task.title},
                  ${task.description},
                  ${TaskStatus.TODO},
                  ${task.priority}
                )
              `;
            }

            return {
              content: [{
                type: "text",
                text: `**PRD Parsed Successfully**\n\nGenerated ${tasks.length} tasks for project "${project.name}".\n\nUse \`task-list --projectId="${projectId}"\` to view all tasks.`
              }]
            };
          });
        } catch (error) {
          console.error('PRD parsing error:', error);
          return {
            content: [{
              type: "text",
              text: `Failed to parse PRD: ${formatDatabaseError(error)}`,
              isError: true
            }]
          };
        }
      }
    );
  }

  private registerTaskTools() {
    // Task management tools implementation
    this.server.tool(
      "task-next",
      "Intelligently identify the next task to work on based on dependencies and priority",
      {
        projectId: z.string().uuid().describe("Project ID")
      },
      async ({ projectId }) => {
        try {
          return await withDatabase(this.env.DATABASE_URL, async (db) => {
            // Verify project ownership
            const [project] = await db`
              SELECT id FROM projects 
              WHERE id = ${projectId} 
              AND user_id = ${this.props.login}
            `;

            if (!project) {
              return {
                content: [{
                  type: "text",
                  text: "Project not found or access denied.",
                  isError: true
                }]
              };
            }

            // Find next task: prioritize by status and priority
            const [nextTask] = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${projectId}
              AND status IN (${TaskStatus.TODO}, ${TaskStatus.BLOCKED})
              ORDER BY 
                CASE status 
                  WHEN ${TaskStatus.BLOCKED} THEN 1 
                  WHEN ${TaskStatus.TODO} THEN 2 
                END,
                CASE priority 
                  WHEN ${TaskPriority.CRITICAL} THEN 1
                  WHEN ${TaskPriority.HIGH} THEN 2
                  WHEN ${TaskPriority.MEDIUM} THEN 3
                  WHEN ${TaskPriority.LOW} THEN 4
                END,
                created_at ASC
              LIMIT 1
            `;

            if (!nextTask) {
              return {
                content: [{
                  type: "text",
                  text: "No pending tasks found. All tasks may be completed or in progress."
                }]
              };
            }

            return {
              content: [{
                type: "text",
                text: `**Next Recommended Task**\n\n**Title:** ${nextTask.title}\n**Priority:** ${nextTask.priority}\n**Status:** ${nextTask.status}\n\n**Description:**\n${nextTask.description}\n\n**Task ID:** ${nextTask.id}`
              }]
            };
          });
        } catch (error) {
          console.error('Task next error:', error);
          return {
            content: [{
              type: "text",
              text: `Failed to identify next task: ${formatDatabaseError(error)}`,
              isError: true
            }]
          };
        }
      }
    );

    // Additional task tools (task-list, task-update, task-complete) would follow similar patterns
  }

  private registerAnalyticsTools() {
    // Project analytics and research tools
    this.server.tool(
      "project-research",
      "Conduct contextual research with project-specific information",
      {
        projectId: z.string().uuid(),
        query: z.string().min(1).max(500).describe("Research query"),
        includeContext: z.boolean().default(true)
      },
      async ({ projectId, query, includeContext }) => {
        // Implementation would integrate with AI services for contextual research
        return {
          content: [{
            type: "text",
            text: `Research functionality for "${query}" would be implemented here with project context.`
          }]
        };
      }
    );
  }

  // Helper method for PRD parsing using Anthropic
  private async generateTasksFromPRD(prdContent: string, project: any, maxTasks: number): Promise<any[]> {
    try {
      // Use Anthropic API for intelligent PRD parsing
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Parse the following PRD and generate up to ${maxTasks} actionable development tasks. 
            
PRD Content:
${prdContent}

For each task, provide:
1. A clear, concise title (max 100 chars)
2. A detailed description
3. Priority (critical, high, medium, or low)
4. Any dependencies on other tasks

Return as JSON array with format:
[{"title": "...", "description": "...", "priority": "high"}]`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.content[0].text;
      
      // Parse the JSON response
      const tasks = JSON.parse(content);
      
      // Validate and normalize tasks
      return tasks.slice(0, maxTasks).map((task: any) => ({
        title: task.title.substring(0, 100),
        description: task.description || task.title,
        priority: task.priority || TaskPriority.MEDIUM
      }));
      
    } catch (error) {
      console.error('AI PRD parsing failed, falling back to simple parsing:', error);
      
      // Fallback to simple parsing if AI fails
      const lines = prdContent.split('\n').filter(line => line.trim());
      const tasks = [];
      
      for (const line of lines) {
        if (line.includes('must') || line.includes('should') || line.includes('will')) {
          tasks.push({
            title: line.substring(0, 100),
            description: line,
            priority: line.includes('must') ? TaskPriority.HIGH : TaskPriority.MEDIUM
          });
          
          if (tasks.length >= maxTasks) break;
        }
      }
      
      return tasks;
    }
  }
}

// Export OAuth provider with MCP endpoints
export default new OAuthProvider({
  apiHandlers: {
    "/sse": ProjectMasterMCP.serveSSE("/sse") as any,
    "/mcp": ProjectMasterMCP.serve("/mcp") as any,
  },
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: GitHubHandler as any,
  tokenEndpoint: "/token",
});
```

### Integration Points

```yaml
CLOUDFLARE_WORKERS:
  - wrangler-project-master.jsonc: Configure with project-master-mcp name
  - Environment secrets: Reuse existing OAuth credentials
  - Durable Objects: Use existing MCP agent binding configuration

GITHUB_OAUTH:
  - GitHub App: Reuse existing app or create project-specific
  - Permissions: Read user profile for project ownership
  - Teams API: Optional for shared project features

DATABASE:
  - PostgreSQL: Add project/task tables via migration
  - Indexes: user_id, project_id, status for performance
  - Transactions: Use for complex operations like PRD parsing

ENVIRONMENT_VARIABLES:
  - Required: All existing OAuth and database variables
  - Required: ANTHROPIC_API_KEY for intelligent PRD parsing
  - Optional: AI_MODEL_ENDPOINT for custom AI endpoints
  - Optional: SENTRY_DSN for production monitoring

CLAUDE_DESKTOP_CONFIG:
  Development:
    {
      "mcpServers": {
        "project-master": {
          "command": "npx",
          "args": ["mcp-remote", "http://localhost:8788/mcp"],
          "env": {}
        }
      }
    }

  Production:
    {
      "mcpServers": {
        "project-master": {
          "command": "npx",
          "args": ["mcp-remote", "https://project-master.your-domain.workers.dev/mcp"],
          "env": {}
        }
      }
    }
```

## Validation Loop

### Level 1: TypeScript & Configuration

```bash
# CRITICAL: Run these FIRST - fix any errors before proceeding
npm run type-check                 # TypeScript compilation
wrangler types                     # Generate Cloudflare Workers types

# Expected: No TypeScript errors
# Common fixes:
# - Missing imports: Add proper imports for all types
# - Type mismatches: Ensure Props type matches OAuth response
# - Environment types: Run wrangler types to generate worker-configuration.d.ts
```

### Level 2: Database Setup

```bash
# Create and verify database schema
psql $DATABASE_URL < migrations/001_project_schema.sql

# Verify tables exist
psql $DATABASE_URL -c "\dt"

# Expected: projects, tasks, project_members tables visible
# If errors: Check PostgreSQL connection, user permissions
```

### Level 3: Local Development Testing

```bash
# Start local development server
wrangler dev --config wrangler-project-master.jsonc

# Test OAuth flow (should redirect to GitHub)
curl -v http://localhost:8788/authorize

# Test MCP endpoint (should return server info)
curl -v http://localhost:8788/mcp

# Expected: Server starts, OAuth works, MCP responds
```

### Level 4: Tool Functionality Testing

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector@latest

# Add server configuration:
# URL: http://localhost:8788/mcp
# Transport: HTTP + SSE

# Test each tool:
# 1. project-init with sample data
# 2. project-list to verify creation
# 3. parse-prp with sample PRP
# 4. task-list to see generated tasks
# 5. task-next to get recommendations

# Expected: All tools execute without errors
```

### Level 5: User Isolation Testing

```bash
# Test with different GitHub accounts
# 1. Login with User A, create projects
# 2. Login with User B, verify cannot see User A's projects
# 3. Test all operations respect user boundaries

# Expected: Complete user isolation
```

## Final Validation Checklist

### Core Functionality

- [ ] TypeScript compilation: `npm run type-check` passes
- [ ] Database schema: All tables created with proper indexes
- [ ] Local server starts: `wrangler dev` runs without errors
- [ ] MCP endpoint responds: Returns server capabilities
- [ ] OAuth flow: Complete GitHub authentication cycle
- [ ] Project creation: Can initialize new projects
- [ ] PRD parsing: Generates meaningful tasks from PRDs
- [ ] Task management: CRUD operations work correctly
- [ ] User isolation: Users only see their own data
- [ ] Error handling: Graceful errors without system leaks

### Production Readiness

- [ ] Secrets configured: All production secrets set
- [ ] Database migrations: Run successfully in production
- [ ] Deployment: `wrangler deploy` succeeds
- [ ] Monitoring: Logs capture key events
- [ ] Performance: Queries execute within timeout limits

---

## Anti-Patterns to Avoid

### MCP-Specific

- ❌ Don't skip Zod validation - validate all tool inputs
- ❌ Don't forget cleanup() method - prevents connection leaks
- ❌ Don't expose other users' data - always filter by user_id
- ❌ Don't allow SQL injection - use parameterized queries

### Project Management Specific

- ❌ Don't create unlimited tasks - enforce reasonable limits
- ❌ Don't ignore task dependencies - validate relationships
- ❌ Don't lose project context - maintain across sessions
- ❌ Don't skip user authorization - verify project ownership

### Development Process

- ❌ Don't skip validation loops - each catches different issues
- ❌ Don't hardcode user IDs - use OAuth props.login
- ❌ Don't forget error logging - essential for debugging
- ❌ Don't deploy without testing - verify all tools work

## Next Steps

After successful deployment:

1. **Enhance PRD Parsing**: Integrate with AI services for intelligent task generation
2. **Add Team Features**: Implement project sharing and collaboration
3. **Build UI**: Create web interface for project visualization
4. **Add Webhooks**: Integrate with GitHub for automated task updates
5. **Implement Analytics**: Add project metrics and burndown charts