/**
 * Project management MCP tools
 * Handles project initialization, listing, and details
 */

import { withDatabase } from "../../database";
import { 
  Schemas, 
  Props, 
  Env, 
  ProjectStatus
} from "../types";
import { dbProjectToProject } from "../database/schema";
import { 
  createErrorResponse, 
  createSuccessResponse, 
  createListResponse,
  createDetailResponse,
  createInfoResponse
} from "../utils/response-utils";
import { calculateProjectAnalytics, generateProjectSummary } from "../utils/task-utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerProjectTools(server: McpServer, env: Env, props: Props) {
  
  // Tool 1: Initialize new project
  server.tool(
    "project-init",
    "Initialize a new AI coding project with metadata and configuration. Creates a new project record in the database.",
    Schemas.ProjectInit.shape,
    async ({ name, description, prpContent, context }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Check for duplicate project name for this user
          const existing = await db`
            SELECT id FROM projects 
            WHERE user_id = ${props.login} 
            AND name = ${name}
          `;
          
          if (existing.length > 0) {
            return createErrorResponse(
              `A project named "${name}" already exists for your account`,
              { existingProjectId: existing[0].id }
            );
          }

          // Create new project
          const [project] = await db`
            INSERT INTO projects (
              user_id, name, description, status, prp_content, context
            ) VALUES (
              ${props.login},
              ${name},
              ${description || ''},
              ${ProjectStatus.PLANNING},
              ${prpContent || null},
              ${JSON.stringify(context || {})}
            )
            RETURNING *
          `;

          console.log(`Project created: ${project.id} by ${props.login}`);

          return createSuccessResponse("Project created successfully", {
            projectId: project.id,
            name: project.name,
            status: project.status,
            createdAt: project.created_at,
            nextSteps: [
              `Use parse-prp --projectId="${project.id}" to generate tasks from your PRP content`,
              `Use task-list --projectId="${project.id}" to view all tasks for this project`,
              `Use task-next --projectId="${project.id}" to identify what to work on first`
            ]
          });
        });
      } catch (error) {
        console.error('Project initialization error:', error);
        return createErrorResponse('Failed to create project', { 
          error: (error as any).message 
        });
      }
    }
  );

  // Tool 2: List user's projects
  server.tool(
    "project-list",
    "List all projects for the authenticated user with filtering and pagination options.",
    Schemas.ProjectList.shape,
    async ({ status, limit }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          const query = status
            ? db`SELECT * FROM projects WHERE user_id = ${props.login} AND status = ${status} ORDER BY updated_at DESC LIMIT ${limit}`
            : db`SELECT * FROM projects WHERE user_id = ${props.login} ORDER BY updated_at DESC LIMIT ${limit}`;
          
          const projects = await query;

          if (projects.length === 0) {
            return createInfoResponse(
              "No Projects Found",
              status ? `No projects with status "${status}" found.` : 'You haven\'t created any projects yet.',
              {
                suggestion: "Use project-init to create your first project",
                example: 'project-init --name="My Web App" --description="A modern web application"'
              }
            );
          }

          // Get task counts for each project
          const projectsWithStats = await Promise.all(
            projects.map(async (project: any) => {
              const [stats] = await db`
                SELECT 
                  COUNT(*) as total_tasks,
                  COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_tasks,
                  COALESCE(SUM(estimated_hours), 0) as total_estimated_hours
                FROM tasks 
                WHERE project_id = ${project.id}
              `;
              
              return {
                ...project,
                totalTasks: parseInt(stats.total_tasks),
                completedTasks: parseInt(stats.completed_tasks),
                totalEstimatedHours: parseFloat(stats.total_estimated_hours)
              };
            })
          );

          const formatProject = (p: any) => {
            const completionRate = p.totalTasks > 0 ? 
              (p.completedTasks / p.totalTasks * 100).toFixed(1) : '0.0';
            
            return `**${p.name}** (${p.id})
- Status: ${p.status.toUpperCase()}
- Tasks: ${p.completedTasks}/${p.totalTasks} (${completionRate}% complete)
- Created: ${new Date(p.created_at).toLocaleDateString()}

**Commands:**
- \`project-get --projectId="${p.id}"\` - Get project details
- \`task-list --projectId="${p.id}"\` - View project tasks
- \`task-next --projectId="${p.id}"\` - Get next recommended task`;
          };

          return createListResponse(
            "Your Projects",
            projectsWithStats,
            formatProject
          );
        });
      } catch (error) {
        console.error('Project listing error:', error);
        return createErrorResponse('Failed to list projects', { 
          error: (error as any).message 
        });
      }
    }
  );

  // Tool 3: Get project details
  server.tool(
    "project-get",
    "Get detailed information about a specific project including tasks summary and analytics.",
    Schemas.ProjectGet.shape,
    async ({ projectId }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Get project details
          const [project] = await db`
            SELECT * FROM projects 
            WHERE id = ${projectId} 
            AND user_id = ${props.login}
          `;

          if (!project) {
            return createErrorResponse('Project not found or access denied');
          }

          // Get project tasks
          const tasks = await db`
            SELECT * FROM tasks 
            WHERE project_id = ${projectId}
            ORDER BY created_at DESC
          `;

          const analytics = calculateProjectAnalytics(tasks as any);
          const summary = generateProjectSummary(project.name, tasks as any, analytics);

          const formatProject = (proj: any) => `${summary}

**Project Details:**
- **ID:** ${proj.id}
- **Description:** ${proj.description || 'No description'}
- **Status:** ${proj.status.toUpperCase()}
- **Created:** ${new Date(proj.created_at).toLocaleDateString()}
- **Updated:** ${new Date(proj.updated_at).toLocaleDateString()}

**Recent Tasks:**
${tasks.slice(0, 5).map((task: any) => 
  `- ${task.status === 'done' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏳'} **${task.title}** (${task.priority})`
).join('\n') || '- No tasks yet'}`;

          const actions = [
            `task-list --projectId="${projectId}" - View all tasks`,
            `task-next --projectId="${projectId}" - Get next task`,
            `parse-prp --projectId="${projectId}" - Generate tasks from PRP`
          ];

          return createDetailResponse(
            "Project Details",
            project,
            formatProject,
            actions
          );
        });
      } catch (error) {
        console.error('Project get error:', error);
        return createErrorResponse('Failed to get project details', { 
          error: (error as any).message 
        });
      }
    }
  );
}