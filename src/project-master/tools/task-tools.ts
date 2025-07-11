/**
 * Task management MCP tools
 * Handles task CRUD operations and workflow management
 */

import { withDatabase } from "../../database";
import { 
  Schemas, 
  Props, 
  Env, 
  TaskStatus,
  ALLOWED_USERNAMES
} from "../types";
import { 
  createErrorResponse, 
  createSuccessResponse,
  createListResponse,
  createDetailResponse,
  createPermissionDeniedResponse,
  createNotFoundResponse
} from "../utils/response-utils";
import { 
  findNextTask, 
  checkProjectPermission,
  formatDuration,
  formatPriority,
  formatStatus
} from "../utils/task-utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTaskTools(server: McpServer, env: Env, props: Props) {
  const isPrivileged = ALLOWED_USERNAMES.has(props.login);

  // Tool: List tasks for a project
  server.tool(
    "task-list",
    "List all tasks for a project with filtering, sorting, and pagination options.",
    Schemas.TaskList.shape,
    async ({ projectId, status, priority, assignee, limit, offset }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Verify project ownership
          const [project] = await db`
            SELECT name FROM projects 
            WHERE id = ${projectId} 
            AND user_id = ${props.login}
          `;

          if (!project) {
            return createErrorResponse('Project not found or access denied');
          }

          // Build query with filters
          let tasks: any[];
          if (status && priority && assignee) {
            tasks = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${projectId} AND status = ${status} AND priority = ${priority} AND assignee = ${assignee}
              ORDER BY 
                CASE priority 
                  WHEN 'critical' THEN 1
                  WHEN 'high' THEN 2
                  WHEN 'medium' THEN 3
                  WHEN 'low' THEN 4
                END,
                created_at ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
          } else if (status && priority) {
            tasks = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${projectId} AND status = ${status} AND priority = ${priority}
              ORDER BY 
                CASE priority 
                  WHEN 'critical' THEN 1
                  WHEN 'high' THEN 2
                  WHEN 'medium' THEN 3
                  WHEN 'low' THEN 4
                END,
                created_at ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
          } else if (status) {
            tasks = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${projectId} AND status = ${status}
              ORDER BY 
                CASE priority 
                  WHEN 'critical' THEN 1
                  WHEN 'high' THEN 2
                  WHEN 'medium' THEN 3
                  WHEN 'low' THEN 4
                END,
                created_at ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
          } else if (priority) {
            tasks = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${projectId} AND priority = ${priority}
              ORDER BY 
                CASE priority 
                  WHEN 'critical' THEN 1
                  WHEN 'high' THEN 2
                  WHEN 'medium' THEN 3
                  WHEN 'low' THEN 4
                END,
                created_at ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
          } else if (assignee) {
            tasks = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${projectId} AND assignee = ${assignee}
              ORDER BY 
                CASE priority 
                  WHEN 'critical' THEN 1
                  WHEN 'high' THEN 2
                  WHEN 'medium' THEN 3
                  WHEN 'low' THEN 4
                END,
                created_at ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
          } else {
            tasks = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${projectId}
              ORDER BY 
                CASE priority 
                  WHEN 'critical' THEN 1
                  WHEN 'high' THEN 2
                  WHEN 'medium' THEN 3
                  WHEN 'low' THEN 4
                END,
                created_at ASC
              LIMIT ${limit} OFFSET ${offset}
            `;
          }

          if (tasks.length === 0) {
            return createErrorResponse('No tasks found', {
              suggestion: `Use parse-prp --projectId="${projectId}" to generate tasks from your PRP`,
              alternative: `Use task-create --projectId="${projectId}" to create tasks manually`
            });
          }

          const formatTask = (task: any, index: number) => {
            // Helper function to safely convert to number for duration formatting
            const safeToNumber = (value: string | number | null | undefined): number | undefined => {
              if (value === null || value === undefined) return undefined;
              if (typeof value === 'string') {
                const num = parseFloat(value);
                return isNaN(num) ? undefined : num;
              }
              return typeof value === 'number' ? value : undefined;
            };
            
            const estimatedHours = safeToNumber(task.estimated_hours);
            const duration = estimatedHours ? formatDuration(estimatedHours) : 'No estimate';
            const assigneeText = task.assignee ? ` (assigned to @${task.assignee})` : '';
            
            return `**${offset + index + 1}. ${task.title}** (${task.id})
${formatStatus(task.status)} | ${formatPriority(task.priority)} | ${duration}${assigneeText}
${task.description ? task.description.substring(0, 150) + (task.description.length > 150 ? '...' : '') : 'No description'}`;
          };

          // Get total count for pagination
          const [totalResult] = await db`
            SELECT COUNT(*) as count FROM tasks WHERE project_id = ${projectId}
          `;
          const total = parseInt(totalResult.count);

          return createListResponse(
            `Tasks for ${project.name}`,
            tasks,
            formatTask,
            {
              total,
              limit,
              offset,
              hasMore: offset + limit < total
            }
          );
        });
      } catch (error) {
        console.error('Task listing error:', error);
        return createErrorResponse('Failed to list tasks', { 
          error: (error as any).message 
        });
      }
    }
  );

  // Tool: Get next recommended task
  server.tool(
    "task-next",
    "Intelligently identify the next task to work on based on dependencies, priority, and status.",
    Schemas.TaskNext.shape,
    async ({ projectId, excludeBlocked }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Verify project ownership
          const [project] = await db`
            SELECT name FROM projects 
            WHERE id = ${projectId} 
            AND user_id = ${props.login}
          `;

          if (!project) {
            return createErrorResponse('Project not found or access denied');
          }

          // Get all tasks for dependency analysis
          const tasks = await db`
            SELECT * FROM tasks 
            WHERE project_id = ${projectId}
            ORDER BY created_at ASC
          `;

          if (tasks.length === 0) {
            return createErrorResponse('No tasks found', {
              suggestion: `Use parse-prp --projectId="${projectId}" to generate tasks from your PRP`
            });
          }

          const nextTask = findNextTask(tasks as any, excludeBlocked);

          if (!nextTask) {
            const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
            const blocked = tasks.filter(t => t.status === TaskStatus.BLOCKED);
            
            return createErrorResponse('No available tasks', {
              inProgress: inProgress.length,
              blocked: blocked.length,
              completed: tasks.filter(t => t.status === TaskStatus.DONE).length,
              suggestions: [
                ...(blocked.length > 0 ? ['Resolve blocked tasks to unblock dependencies'] : []),
                ...(inProgress.length > 0 ? ['Complete in-progress tasks'] : []),
                'Create new tasks if needed'
              ]
            });
          }

          const duration = (nextTask as any).estimated_hours ? 
            formatDuration((nextTask as any).estimated_hours) : 'No estimate';
          const dependencies = nextTask.dependencies && nextTask.dependencies.length > 0 ? 
            nextTask.dependencies.length : 0;

          const formatTask = () => `**${nextTask.title}**
${formatStatus(nextTask.status)} | ${formatPriority(nextTask.priority)} | ${duration}

**Description:**
${nextTask.description || 'No description provided'}

**Task Details:**
- **ID:** ${nextTask.id}
- **Dependencies:** ${dependencies} task(s)
- **Created:** ${new Date((nextTask as any).created_at).toLocaleDateString()}
- **Assignee:** ${nextTask.assignee || 'Unassigned'}`;

          const actions = [
            `task-update --taskId="${nextTask.id}" --status="in_progress" - Start working on this task`,
            `task-get --taskId="${nextTask.id}" - Get full task details`,
            `task-complete --taskId="${nextTask.id}" - Mark as complete when done`
          ];

          return createDetailResponse(
            "Next Recommended Task",
            nextTask,
            formatTask,
            actions
          );
        });
      } catch (error) {
        console.error('Task next error:', error);
        return createErrorResponse('Failed to identify next task', { 
          error: (error as any).message 
        });
      }
    }
  );

  // Tool: Get task details
  server.tool(
    "task-get",
    "Get detailed information about a specific task including dependencies and history.",
    Schemas.TaskGet.shape,
    async ({ taskId }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Get task with project info
          const [task] = await db`
            SELECT t.*, p.name as project_name, p.user_id as project_user_id
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            WHERE t.id = ${taskId}
          `;

          if (!task) {
            return createNotFoundResponse('Task', taskId);
          }

          // Check project permission
          const permission = checkProjectPermission(task.project_user_id, props);
          if (!permission.hasPermission) {
            return createPermissionDeniedResponse('task');
          }

          const formatTask = (t: any) => {
            // Helper function to safely convert to number for duration formatting
            const safeToNumber = (value: string | number | null | undefined): number | undefined => {
              if (value === null || value === undefined) return undefined;
              if (typeof value === 'string') {
                const num = parseFloat(value);
                return isNaN(num) ? undefined : num;
              }
              return typeof value === 'number' ? value : undefined;
            };
            
            const estimatedHours = safeToNumber(t.estimated_hours);
            const actualHours = safeToNumber(t.actual_hours);
            const duration = estimatedHours ? formatDuration(estimatedHours) : 'No estimate';
            const actualDuration = actualHours ? formatDuration(actualHours) : 'Not tracked';
            const dependencies = t.dependencies && t.dependencies.length > 0 ? 
              t.dependencies.length : 0;
            
            const efficiency = estimatedHours && actualHours && estimatedHours > 0 && actualHours > 0 ? 
              `${((estimatedHours / actualHours) * 100).toFixed(1)}%` : 'N/A';

            return `**${t.title}**
${formatStatus(t.status)} | ${formatPriority(t.priority)}

**Project:** ${t.project_name}
**ID:** ${t.id}

**Description:**
${t.description || 'No description provided'}

**Time Tracking:**
- **Estimated:** ${duration}
- **Actual:** ${actualDuration}
- **Efficiency:** ${efficiency}

**Details:**
- **Dependencies:** ${dependencies} task(s)
- **Assignee:** ${t.assignee || 'Unassigned'}
- **Created:** ${new Date(t.created_at).toLocaleDateString()}
- **Updated:** ${new Date(t.updated_at).toLocaleDateString()}
${t.completed_at ? `- **Completed:** ${new Date(t.completed_at).toLocaleDateString()}` : ''}

${t.notes ? `**Notes:**\n${t.notes}` : ''}`;
          };

          const actions = [
            `task-update --taskId="${taskId}" - Update this task`,
            `task-complete --taskId="${taskId}" - Mark as complete`,
            `task-list --projectId="${task.project_id}" - View all project tasks`
          ];

          return createDetailResponse(
            "Task Details",
            task,
            formatTask,
            actions
          );
        });
      } catch (error) {
        console.error('Task get error:', error);
        return createErrorResponse('Failed to get task details', { 
          error: (error as any).message 
        });
      }
    }
  );

  // Tool: Update task (privileged users only)
  if (isPrivileged) {
    server.tool(
      "task-update",
      "Update a task's properties including status, priority, assignee, and other details. Requires write permissions.",
      Schemas.TaskUpdate.shape,
      async ({ taskId, title, description, status, priority, assignee, estimatedHours, actualHours, notes }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get task with project info for permission check
            const [task] = await db`
              SELECT t.*, p.user_id as project_user_id
              FROM tasks t
              JOIN projects p ON t.project_id = p.id
              WHERE t.id = ${taskId}
            `;

            if (!task) {
              return createNotFoundResponse('Task', taskId);
            }

            // Check project permission
            const permission = checkProjectPermission(task.project_user_id, props);
            if (!permission.hasPermission) {
              return createPermissionDeniedResponse('task');
            }

            // Build update query
            const updates: any = {};
            if (title !== undefined) updates.title = title;
            if (description !== undefined) updates.description = description;
            if (status !== undefined) updates.status = status;
            if (priority !== undefined) updates.priority = priority;
            if (assignee !== undefined) updates.assignee = assignee;
            if (estimatedHours !== undefined) updates.estimated_hours = estimatedHours;
            if (actualHours !== undefined) updates.actual_hours = actualHours;
            if (notes !== undefined) updates.notes = notes;

            if (Object.keys(updates).length === 0) {
              return createErrorResponse('No updates provided');
            }

            // Update the task (using individual queries for simplicity)
            if (title !== undefined) {
              await db`UPDATE tasks SET title = ${title}, updated_at = NOW() WHERE id = ${taskId}`;
            }
            if (description !== undefined) {
              await db`UPDATE tasks SET description = ${description}, updated_at = NOW() WHERE id = ${taskId}`;
            }
            if (status !== undefined) {
              await db`UPDATE tasks SET status = ${status}, updated_at = NOW() WHERE id = ${taskId}`;
            }
            if (priority !== undefined) {
              await db`UPDATE tasks SET priority = ${priority}, updated_at = NOW() WHERE id = ${taskId}`;
            }
            if (assignee !== undefined) {
              await db`UPDATE tasks SET assignee = ${assignee}, updated_at = NOW() WHERE id = ${taskId}`;
            }
            if (estimatedHours !== undefined) {
              await db`UPDATE tasks SET estimated_hours = ${estimatedHours}, updated_at = NOW() WHERE id = ${taskId}`;
            }
            if (actualHours !== undefined) {
              await db`UPDATE tasks SET actual_hours = ${actualHours}, updated_at = NOW() WHERE id = ${taskId}`;
            }
            if (notes !== undefined) {
              await db`UPDATE tasks SET notes = ${notes}, updated_at = NOW() WHERE id = ${taskId}`;
            }

            console.log(`Task updated: ${taskId} by ${props.login}`);

            return createSuccessResponse("Task updated successfully", {
              taskId,
              updatedFields: Object.keys(updates),
              updatedBy: props.login
            });
          });
        } catch (error) {
          console.error('Task update error:', error);
          return createErrorResponse('Failed to update task', { 
            error: (error as any).message 
          });
        }
      }
    );
  }

  // Tool: Complete task (privileged users only)
  if (isPrivileged) {
    server.tool(
      "task-complete",
      "Mark a task as completed with optional actual hours and completion notes. Requires write permissions.",
      Schemas.TaskComplete.shape,
      async ({ taskId, actualHours, notes }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get task with project info for permission check
            const [task] = await db`
              SELECT t.*, p.user_id as project_user_id, p.name as project_name
              FROM tasks t
              JOIN projects p ON t.project_id = p.id
              WHERE t.id = ${taskId}
            `;

            if (!task) {
              return createNotFoundResponse('Task', taskId);
            }

            // Check project permission
            const permission = checkProjectPermission(task.project_user_id, props);
            if (!permission.hasPermission) {
              return createPermissionDeniedResponse('task');
            }

            if (task.status === TaskStatus.DONE) {
              return createErrorResponse('Task is already completed');
            }

            // Update task to completed
            await db`
              UPDATE tasks 
              SET status = ${TaskStatus.DONE}, 
                  actual_hours = ${actualHours || task.actual_hours},
                  notes = ${notes || task.notes},
                  completed_at = NOW(),
                  updated_at = NOW()
              WHERE id = ${taskId}
            `;

            console.log(`Task completed: ${taskId} by ${props.login}`);

            // Helper function to safely convert to number
            const safeToNumber = (value: string | number | null | undefined): number => {
              if (value === null || value === undefined) return 0;
              if (typeof value === 'string') {
                const num = parseFloat(value);
                return isNaN(num) ? 0 : num;
              }
              return typeof value === 'number' ? value : 0;
            };
            
            // Calculate efficiency if both estimated and actual hours are available
            const estimatedNum = safeToNumber(task.estimated_hours);
            const actualNum = safeToNumber(actualHours);
            const efficiency = estimatedNum > 0 && actualNum > 0 ? 
              ((estimatedNum / actualNum) * 100).toFixed(1) : null;

            return createSuccessResponse("Task completed successfully! 🎉", {
              taskId,
              taskTitle: task.title,
              projectName: task.project_name,
              completedBy: `${props.name} (@${props.login})`,
              timeTracking: {
                estimated: task.estimated_hours ? formatDuration(task.estimated_hours) : 'No estimate',
                actual: actualHours ? formatDuration(actualHours) : 'Not tracked',
                efficiency: efficiency ? `${efficiency}%` : 'N/A'
              },
              notes,
              nextSteps: [
                `task-next --projectId="${task.project_id}" - Get next recommended task`,
                `task-list --projectId="${task.project_id}" - View all project tasks`,
                `project-get --projectId="${task.project_id}" - View project progress`
              ]
            });
          });
        } catch (error) {
          console.error('Task complete error:', error);
          return createErrorResponse('Failed to complete task', { 
            error: (error as any).message 
          });
        }
      }
    );
  }
}