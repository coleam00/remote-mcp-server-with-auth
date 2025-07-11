/**
 * Task CRUD operations for MCP tools
 * Provides create, read, update, delete functionality for tasks
 */

import { withDatabase } from "../../database";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  DeleteTaskSchema,
  GetTaskSchema,
  ListTasksSchema,
  AddTaskInfoSchema,
  Props,
  Env,
  createErrorResponse,
  createSuccessResponse,
} from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Privileged users who can perform write operations
const ALLOWED_USERNAMES = new Set<string>(["coleam00"]);

export function registerTaskCRUDTools(server: McpServer, env: Env, props: Props) {
  const isPrivileged = ALLOWED_USERNAMES.has(props.login);

  // Create Task - Privileged users only
  if (isPrivileged) {
    server.tool(
      "createTask",
      "Create a new task associated with a PRP. Requires write permissions.",
      CreateTaskSchema.shape,
      async ({ prpId, description, order, fileToModify, pattern, pseudocode, tags }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify PRP exists
            const prpCheck = await db`
              SELECT id, name FROM prps WHERE id = ${prpId}
            `;

            if (prpCheck.length === 0) {
              return createErrorResponse("PRP not found", { prpId });
            }

            // Create task
            const taskResult = await db`
              INSERT INTO tasks (
                prp_id, task_order, description, file_to_modify,
                pattern, pseudocode, status, additional_info
              ) VALUES (
                ${prpId}, ${order}, ${description}, ${fileToModify || null},
                ${pattern || null}, ${pseudocode || null}, 'pending', '{}'::jsonb
              )
              RETURNING id, created_at
            `;

            const taskId = taskResult[0].id;

            // Add tags if provided
            if (tags && tags.length > 0) {
              // Get or create tags
              const tagResults = await Promise.all(
                tags.map(async (tagName) => {
                  const existing = await db`
                    SELECT id FROM tags WHERE name = ${tagName}
                  `;

                  if (existing.length > 0) {
                    return existing[0].id;
                  }

                  const newTag = await db`
                    INSERT INTO tags (name, created_by)
                    VALUES (${tagName}, ${props.login})
                    RETURNING id
                  `;
                  return newTag[0].id;
                }),
              );

              // Associate tags with task
              const taskTagData = tagResults.map((tagId) => ({
                task_id: taskId,
                tag_id: tagId,
              }));

              await db`
                INSERT INTO task_tags ${db(taskTagData)}
              `;
            }

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                'task', ${taskId}, 'create', ${props.login},
                ${JSON.stringify({ prpId, description, order })}
              )
            `;

            console.log(`Task created: ${taskId} by ${props.login}`);

            return createSuccessResponse("Task created successfully", {
              taskId,
              prpName: prpCheck[0].name,
              order,
              createdAt: taskResult[0].created_at,
            });
          });
        } catch (error) {
          console.error("Create task error:", error);
          return createErrorResponse(`Failed to create task: ${(error as any).message}`);
        }
      },
    );
  }

  // Update Task - Privileged users only
  if (isPrivileged) {
    server.tool(
      "updateTask",
      "Update an existing task. Requires write permissions.",
      UpdateTaskSchema.shape,
      async ({ id, description, status, additionalInfo, tags }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get current task state
            const currentTask = await db`
              SELECT * FROM tasks WHERE id = ${id} AND deleted_at IS NULL
            `;

            if (currentTask.length === 0) {
              return createErrorResponse("Task not found", { taskId: id });
            }

            // Build update query dynamically
            const updates: any = {};
            const changes: any = {};

            if (description !== undefined) {
              updates.description = description;
              changes.description = { from: currentTask[0].description, to: description };
            }

            if (status !== undefined) {
              updates.status = status;
              changes.status = { from: currentTask[0].status, to: status };
            }

            if (additionalInfo !== undefined) {
              updates.additional_info = { ...currentTask[0].additional_info, ...additionalInfo };
              changes.additionalInfo = additionalInfo;
            }

            // Update task if there are changes
            if (Object.keys(updates).length > 0) {
              await db`
                UPDATE tasks
                SET ${db(updates)}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
              `;
            }

            // Update tags if provided
            if (tags !== undefined) {
              // Remove existing tags
              await db`DELETE FROM task_tags WHERE task_id = ${id}`;

              // Add new tags
              if (tags.length > 0) {
                const tagIds = await Promise.all(
                  tags.map(async (tagName) => {
                    const existing = await db`
                      SELECT id FROM tags WHERE name = ${tagName}
                    `;

                    if (existing.length > 0) {
                      return existing[0].id;
                    }

                    const newTag = await db`
                      INSERT INTO tags (name, created_by)
                      VALUES (${tagName}, ${props.login})
                      RETURNING id
                    `;
                    return newTag[0].id;
                  }),
                );

                const taskTagData = tagIds.map((tagId) => ({
                  task_id: id,
                  tag_id: tagId,
                }));

                await db`INSERT INTO task_tags ${db(taskTagData)}`;
              }

              changes.tags = tags;
            }

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                'task', ${id}, 'update', ${props.login},
                ${JSON.stringify(changes)}
              )
            `;

            console.log(`Task updated: ${id} by ${props.login}`);

            return createSuccessResponse("Task updated successfully", {
              taskId: id,
              changes: Object.keys(changes),
            });
          });
        } catch (error) {
          console.error("Update task error:", error);
          return createErrorResponse(`Failed to update task: ${(error as any).message}`);
        }
      },
    );
  }

  // Delete Task - Privileged users only
  if (isPrivileged) {
    server.tool(
      "deleteTask",
      "Delete a task (soft delete by default). Requires write permissions.",
      DeleteTaskSchema.shape,
      async ({ id, hardDelete }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Check task exists
            const taskCheck = await db`
              SELECT id, description FROM tasks WHERE id = ${id}
            `;

            if (taskCheck.length === 0) {
              return createErrorResponse("Task not found", { taskId: id });
            }

            if (hardDelete) {
              // Permanent delete
              await db`DELETE FROM tasks WHERE id = ${id}`;

              await db`
                INSERT INTO prp_audit_log (
                  entity_type, entity_id, action, changed_by, changes
                ) VALUES (
                  'task', ${id}, 'delete', ${props.login},
                  ${JSON.stringify({ type: "hard_delete", description: taskCheck[0].description })}
                )
              `;

              console.log(`Task hard deleted: ${id} by ${props.login}`);
              return createSuccessResponse("Task permanently deleted", { taskId: id });
            } else {
              // Soft delete
              await db`
                UPDATE tasks
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
              `;

              await db`
                INSERT INTO prp_audit_log (
                  entity_type, entity_id, action, changed_by, changes
                ) VALUES (
                  'task', ${id}, 'delete', ${props.login},
                  ${JSON.stringify({ type: "soft_delete" })}
                )
              `;

              console.log(`Task soft deleted: ${id} by ${props.login}`);
              return createSuccessResponse("Task marked as deleted", { taskId: id });
            }
          });
        } catch (error) {
          console.error("Delete task error:", error);
          return createErrorResponse(`Failed to delete task: ${(error as any).message}`);
        }
      },
    );
  }

  // Get Task - Available to all authenticated users
  server.tool(
    "getTask",
    "Retrieve a specific task with full details",
    GetTaskSchema.shape,
    async ({ id, includeTags }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          const taskQuery = await db`
            SELECT
              t.*,
              p.name as prp_name,
              p.description as prp_description
            FROM tasks t
            JOIN prps p ON t.prp_id = p.id
            WHERE t.id = ${id} AND t.deleted_at IS NULL
          `;

          if (taskQuery.length === 0) {
            return createErrorResponse("Task not found", { taskId: id });
          }

          const task = taskQuery[0];
          const result: any = {
            id: task.id,
            prpId: task.prp_id,
            prpName: task.prp_name,
            order: task.task_order,
            description: task.description,
            fileToModify: task.file_to_modify,
            pattern: task.pattern,
            pseudocode: task.pseudocode,
            status: task.status,
            additionalInfo: task.additional_info,
            createdAt: task.created_at,
            updatedAt: task.updated_at,
          };

          // Include tags if requested
          if (includeTags) {
            const tags = await db`
              SELECT t.name, t.description, t.color
              FROM tags t
              JOIN task_tags tt ON t.id = tt.tag_id
              WHERE tt.task_id = ${id}
              ORDER BY t.name
            `;

            result.tags = tags;
          }

          return createSuccessResponse("Task retrieved successfully", result);
        });
      } catch (error) {
        console.error("Get task error:", error);
        return createErrorResponse(`Failed to retrieve task: ${(error as any).message}`);
      }
    },
  );

  // List Tasks - Available to all authenticated users
  server.tool(
    "listTasks",
    "List tasks with filtering and pagination",
    ListTasksSchema.shape,
    async ({ prpId, status, tags, search, includeDeleted, limit, offset }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Build dynamic query
          let query = db`
            SELECT
              t.id,
              t.prp_id,
              t.task_order,
              t.description,
              t.file_to_modify,
              t.status,
              t.created_at,
              t.updated_at,
              p.name as prp_name,
              COALESCE(
                json_agg(
                  DISTINCT jsonb_build_object(
                    'name', tg.name,
                    'color', tg.color
                  )
                ) FILTER (WHERE tg.id IS NOT NULL),
                '[]'::json
              ) as tags
            FROM tasks t
            JOIN prps p ON t.prp_id = p.id
            LEFT JOIN task_tags tt ON t.id = tt.task_id
            LEFT JOIN tags tg ON tt.tag_id = tg.id
            WHERE 1=1
          `;

          // Apply filters
          if (!includeDeleted) {
            query = db`${query} AND t.deleted_at IS NULL`;
          }

          if (prpId) {
            query = db`${query} AND t.prp_id = ${prpId}`;
          }

          if (status) {
            query = db`${query} AND t.status = ${status}`;
          }

          if (search) {
            query = db`${query} AND (
              t.description ILIKE ${"%" + search + "%"} OR
              t.pattern ILIKE ${"%" + search + "%"} OR
              t.pseudocode ILIKE ${"%" + search + "%"}
            )`;
          }

          // Filter by tags if provided
          if (tags && tags.length > 0) {
            query = db`${query} AND EXISTS (
              SELECT 1 FROM task_tags tt2
              JOIN tags tg2 ON tt2.tag_id = tg2.id
              WHERE tt2.task_id = t.id AND tg2.name = ANY(${tags})
            )`;
          }

          // Add grouping and ordering
          query = db`${query}
            GROUP BY t.id, p.name
            ORDER BY t.prp_id, t.task_order
            LIMIT ${limit} OFFSET ${offset}
          `;

          const tasks = await query;

          // Get total count
          let countQuery = db`
            SELECT COUNT(DISTINCT t.id) as total
            FROM tasks t
            WHERE 1=1
          `;

          if (!includeDeleted) {
            countQuery = db`${countQuery} AND t.deleted_at IS NULL`;
          }

          if (prpId) {
            countQuery = db`${countQuery} AND t.prp_id = ${prpId}`;
          }

          if (status) {
            countQuery = db`${countQuery} AND t.status = ${status}`;
          }

          if (search) {
            countQuery = db`${countQuery} AND (
              t.description ILIKE ${"%" + search + "%"} OR
              t.pattern ILIKE ${"%" + search + "%"} OR
              t.pseudocode ILIKE ${"%" + search + "%"}
            )`;
          }

          if (tags && tags.length > 0) {
            countQuery = db`${countQuery} AND EXISTS (
              SELECT 1 FROM task_tags tt2
              JOIN tags tg2 ON tt2.tag_id = tg2.id
              WHERE tt2.task_id = t.id AND tg2.name = ANY(${tags})
            )`;
          }

          const totalResult = await countQuery;
          const total = parseInt(totalResult[0].total);

          return createSuccessResponse("Tasks retrieved successfully", {
            tasks,
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total,
            },
          });
        });
      } catch (error) {
        console.error("List tasks error:", error);
        return createErrorResponse(`Failed to list tasks: ${(error as any).message}`);
      }
    },
  );

  // Add Task Info - Privileged users only
  if (isPrivileged) {
    server.tool(
      "addTaskInfo",
      "Add or update additional information for a task. Requires write permissions.",
      AddTaskInfoSchema.shape,
      async ({ taskId, info, merge }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get current task
            const currentTask = await db`
              SELECT id, additional_info FROM tasks
              WHERE id = ${taskId} AND deleted_at IS NULL
            `;

            if (currentTask.length === 0) {
              return createErrorResponse("Task not found", { taskId });
            }

            // Prepare new info
            const newInfo = merge ? { ...currentTask[0].additional_info, ...info } : info;

            // Update task
            await db`
              UPDATE tasks
              SET additional_info = ${JSON.stringify(newInfo)}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ${taskId}
            `;

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                'task', ${taskId}, 'update', ${props.login},
                ${JSON.stringify({ additionalInfo: info, merge })}
              )
            `;

            console.log(`Task info updated: ${taskId} by ${props.login}`);

            return createSuccessResponse("Task information updated successfully", {
              taskId,
              additionalInfo: newInfo,
            });
          });
        } catch (error) {
          console.error("Add task info error:", error);
          return createErrorResponse(`Failed to add task info: ${(error as any).message}`);
        }
      },
    );
  }
}