/**
 * Tag management operations for MCP tools
 * Provides tag creation, application, and search functionality
 */

import { withDatabase } from "../../database";
import {
  CreateTagSchema,
  TagItemSchema,
  RemoveTagSchema,
  SearchByTagSchema,
  Props,
  Env,
  createErrorResponse,
  createSuccessResponse,
} from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Privileged users who can perform write operations
const ALLOWED_USERNAMES = new Set<string>(["coleam00"]);

export function registerTagTools(server: McpServer, env: Env, props: Props) {
  const isPrivileged = ALLOWED_USERNAMES.has(props.login);

  // Create Tag - Privileged users only
  if (isPrivileged) {
    server.tool(
      "createTag",
      "Create a new tag for organizing PRPs and tasks. Requires write permissions.",
      CreateTagSchema.shape,
      async ({ name, description, color }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Check if tag already exists
            const existingTag = await db`
              SELECT id, name FROM tags WHERE name = ${name}
            `;

            if (existingTag.length > 0) {
              return createErrorResponse("Tag already exists", {
                tagId: existingTag[0].id,
                tagName: existingTag[0].name,
              });
            }

            // Create tag
            const tagResult = await db`
              INSERT INTO tags (name, description, color, created_by)
              VALUES (${name}, ${description || null}, ${color || null}, ${props.login})
              RETURNING id, created_at
            `;

            const tagId = tagResult[0].id;

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                'tag', ${tagId}, 'create', ${props.login},
                ${JSON.stringify({ name, description, color })}
              )
            `;

            console.log(`Tag created: ${name} (${tagId}) by ${props.login}`);

            return createSuccessResponse("Tag created successfully", {
              tagId,
              name,
              description,
              color,
              createdAt: tagResult[0].created_at,
            });
          });
        } catch (error) {
          console.error("Create tag error:", error);
          return createErrorResponse(`Failed to create tag: ${(error as any).message}`);
        }
      },
    );
  }

  // Tag Item - Privileged users only
  if (isPrivileged) {
    server.tool(
      "tagItem",
      "Apply tags to a task or PRP. Requires write permissions.",
      TagItemSchema.shape,
      async ({ itemId, itemType, tagNames }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify item exists
            if (itemType === "task") {
              const taskCheck = await db`
                SELECT id FROM tasks WHERE id = ${itemId} AND deleted_at IS NULL
              `;
              if (taskCheck.length === 0) {
                return createErrorResponse("Task not found", { taskId: itemId });
              }
            } else {
              const prpCheck = await db`
                SELECT id FROM prps WHERE id = ${itemId}
              `;
              if (prpCheck.length === 0) {
                return createErrorResponse("PRP not found", { prpId: itemId });
              }
            }

            // Get or create tags
            const tagIds = await Promise.all(
              tagNames.map(async (tagName) => {
                const existing = await db`
                  SELECT id FROM tags WHERE name = ${tagName}
                `;

                if (existing.length > 0) {
                  return existing[0].id;
                }

                // Auto-create tag if it doesn't exist
                const newTag = await db`
                  INSERT INTO tags (name, created_by)
                  VALUES (${tagName}, ${props.login})
                  RETURNING id
                `;
                console.log(`Auto-created tag: ${tagName}`);
                return newTag[0].id;
              }),
            );

            // Apply tags based on item type
            const appliedTags = [];
            const tableName = itemType === "task" ? "task_tags" : "prp_tags";
            const itemColumn = itemType === "task" ? "task_id" : "prp_id";

            for (const tagId of tagIds) {
              // Check if already tagged
              const existingTag = await db`
                SELECT * FROM ${db(tableName)}
                WHERE ${db(itemColumn)} = ${itemId} AND tag_id = ${tagId}
              `;

              if (existingTag.length === 0) {
                await db`
                  INSERT INTO ${db(tableName)} (${db(itemColumn)}, tag_id)
                  VALUES (${itemId}, ${tagId})
                `;
                appliedTags.push(tagId);
              }
            }

            // Get all current tags for the item
            const currentTags = await db`
              SELECT t.id, t.name, t.color
              FROM tags t
              JOIN ${db(tableName)} tt ON t.id = tt.tag_id
              WHERE tt.${db(itemColumn)} = ${itemId}
              ORDER BY t.name
            `;

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                ${itemType}, ${itemId}, 'tag', ${props.login},
                ${JSON.stringify({ tagNames, appliedCount: appliedTags.length })}
              )
            `;

            console.log(`Tagged ${itemType} ${itemId} with ${appliedTags.length} tags`);

            return createSuccessResponse("Tags applied successfully", {
              itemId,
              itemType,
              appliedTags: appliedTags.length,
              skippedTags: tagNames.length - appliedTags.length,
              currentTags,
            });
          });
        } catch (error) {
          console.error("Tag item error:", error);
          return createErrorResponse(`Failed to tag item: ${(error as any).message}`);
        }
      },
    );
  }

  // Remove Tag - Privileged users only
  if (isPrivileged) {
    server.tool(
      "removeTag",
      "Remove a tag from a task or PRP. Requires write permissions.",
      RemoveTagSchema.shape,
      async ({ itemId, itemType, tagName }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get tag ID
            const tagResult = await db`
              SELECT id FROM tags WHERE name = ${tagName}
            `;

            if (tagResult.length === 0) {
              return createErrorResponse("Tag not found", { tagName });
            }

            const tagId = tagResult[0].id;
            const tableName = itemType === "task" ? "task_tags" : "prp_tags";
            const itemColumn = itemType === "task" ? "task_id" : "prp_id";

            // Remove tag association
            const deleteResult = await db`
              DELETE FROM ${db(tableName)}
              WHERE ${db(itemColumn)} = ${itemId} AND tag_id = ${tagId}
              RETURNING *
            `;

            if (deleteResult.length === 0) {
              return createErrorResponse("Tag not applied to item", {
                itemId,
                itemType,
                tagName,
              });
            }

            // Get remaining tags
            const remainingTags = await db`
              SELECT t.id, t.name, t.color
              FROM tags t
              JOIN ${db(tableName)} tt ON t.id = tt.tag_id
              WHERE tt.${db(itemColumn)} = ${itemId}
              ORDER BY t.name
            `;

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                ${itemType}, ${itemId}, 'untag', ${props.login},
                ${JSON.stringify({ tagName, tagId })}
              )
            `;

            console.log(`Removed tag ${tagName} from ${itemType} ${itemId}`);

            return createSuccessResponse("Tag removed successfully", {
              itemId,
              itemType,
              removedTag: tagName,
              remainingTags,
            });
          });
        } catch (error) {
          console.error("Remove tag error:", error);
          return createErrorResponse(`Failed to remove tag: ${(error as any).message}`);
        }
      },
    );
  }

  // Search by Tag - Available to all authenticated users
  server.tool(
    "searchByTag",
    "Search for PRPs or tasks by tag names",
    SearchByTagSchema.shape,
    async ({ tagNames, itemType, matchAll, limit, offset }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          const results: any = {};

          // Get tag IDs
          const tagResults = await db`
            SELECT id, name FROM tags
            WHERE name = ANY(${tagNames})
          `;

          if (tagResults.length === 0) {
            return createSuccessResponse("No matching tags found", {
              tasks: [],
              prps: [],
              pagination: { total: 0, limit, offset, hasMore: false },
            });
          }

          const tagIds = tagResults.map((t) => t.id);
          const foundTags = tagResults.map((t) => t.name);

          // Search tasks
          if (itemType === "task" || itemType === "all") {
            let taskQuery;
            if (matchAll) {
              // Must have ALL specified tags
              taskQuery = await db`
                SELECT DISTINCT
                  t.id,
                  t.prp_id,
                  t.task_order,
                  t.description,
                  t.status,
                  t.created_at,
                  p.name as prp_name,
                  array_agg(DISTINCT tg.name) as tags
                FROM tasks t
                JOIN prps p ON t.prp_id = p.id
                JOIN task_tags tt ON t.id = tt.task_id
                JOIN tags tg ON tt.tag_id = tg.id
                WHERE t.deleted_at IS NULL
                  AND t.id IN (
                    SELECT task_id
                    FROM task_tags
                    WHERE tag_id = ANY(${tagIds})
                    GROUP BY task_id
                    HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
                  )
                GROUP BY t.id, p.name
                ORDER BY t.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              // Must have ANY of the specified tags
              taskQuery = await db`
                SELECT DISTINCT
                  t.id,
                  t.prp_id,
                  t.task_order,
                  t.description,
                  t.status,
                  t.created_at,
                  p.name as prp_name,
                  array_agg(DISTINCT tg.name) as tags
                FROM tasks t
                JOIN prps p ON t.prp_id = p.id
                JOIN task_tags tt ON t.id = tt.task_id
                JOIN tags tg ON tt.tag_id = tg.id
                WHERE t.deleted_at IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM task_tags tt2
                    WHERE tt2.task_id = t.id
                      AND tt2.tag_id = ANY(${tagIds})
                  )
                GROUP BY t.id, p.name
                ORDER BY t.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `;
            }

            results.tasks = taskQuery;
          }

          // Search PRPs
          if (itemType === "prp" || itemType === "all") {
            let prpQuery;
            if (matchAll) {
              // Must have ALL specified tags
              prpQuery = await db`
                SELECT DISTINCT
                  p.id,
                  p.name,
                  p.description,
                  p.created_by,
                  p.created_at,
                  array_agg(DISTINCT tg.name) as tags,
                  COUNT(DISTINCT t.id) as task_count
                FROM prps p
                LEFT JOIN tasks t ON p.id = t.prp_id AND t.deleted_at IS NULL
                JOIN prp_tags pt ON p.id = pt.prp_id
                JOIN tags tg ON pt.tag_id = tg.id
                WHERE p.id IN (
                  SELECT prp_id
                  FROM prp_tags
                  WHERE tag_id = ANY(${tagIds})
                  GROUP BY prp_id
                  HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
                )
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              // Must have ANY of the specified tags
              prpQuery = await db`
                SELECT DISTINCT
                  p.id,
                  p.name,
                  p.description,
                  p.created_by,
                  p.created_at,
                  array_agg(DISTINCT tg.name) as tags,
                  COUNT(DISTINCT t.id) as task_count
                FROM prps p
                LEFT JOIN tasks t ON p.id = t.prp_id AND t.deleted_at IS NULL
                JOIN prp_tags pt ON p.id = pt.prp_id
                JOIN tags tg ON pt.tag_id = tg.id
                WHERE EXISTS (
                  SELECT 1
                  FROM prp_tags pt2
                  WHERE pt2.prp_id = p.id
                    AND pt2.tag_id = ANY(${tagIds})
                )
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `;
            }

            results.prps = prpQuery.map((prp) => ({
              ...prp,
              task_count: parseInt(prp.task_count),
            }));
          }

          // Get totals
          let totalTasks = 0;
          let totalPRPs = 0;

          if (results.tasks) {
            const taskCount = await db`
              SELECT COUNT(DISTINCT t.id) as count
              FROM tasks t
              WHERE t.deleted_at IS NULL
                ${
                  matchAll
                    ? db`AND t.id IN (
                    SELECT task_id
                    FROM task_tags
                    WHERE tag_id = ANY(${tagIds})
                    GROUP BY task_id
                    HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
                  )`
                    : db`AND EXISTS (
                    SELECT 1
                    FROM task_tags tt
                    WHERE tt.task_id = t.id
                      AND tt.tag_id = ANY(${tagIds})
                  )`
                }
            `;
            totalTasks = parseInt(taskCount[0].count);
          }

          if (results.prps) {
            const prpCount = await db`
              SELECT COUNT(DISTINCT p.id) as count
              FROM prps p
              WHERE 1=1
                ${
                  matchAll
                    ? db`AND p.id IN (
                    SELECT prp_id
                    FROM prp_tags
                    WHERE tag_id = ANY(${tagIds})
                    GROUP BY prp_id
                    HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
                  )`
                    : db`AND EXISTS (
                    SELECT 1
                    FROM prp_tags pt
                    WHERE pt.prp_id = p.id
                      AND pt.tag_id = ANY(${tagIds})
                  )`
                }
            `;
            totalPRPs = parseInt(prpCount[0].count);
          }

          const total = totalTasks + totalPRPs;

          return createSuccessResponse("Search completed successfully", {
            searchCriteria: {
              tags: foundTags,
              matchAll,
              itemType,
            },
            tasks: results.tasks || [],
            prps: results.prps || [],
            pagination: {
              total,
              totalTasks,
              totalPRPs,
              limit,
              offset,
              hasMore: offset + limit < total,
            },
          });
        });
      } catch (error) {
        console.error("Search by tag error:", error);
        return createErrorResponse(`Failed to search by tag: ${(error as any).message}`);
      }
    },
  );

  // List All Tags - Available to all authenticated users
  server.tool(
    "listTags",
    "List all available tags with usage statistics",
    {},
    async () => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          const tags = await db`
            SELECT
              t.id,
              t.name,
              t.description,
              t.color,
              t.created_by,
              t.created_at,
              COUNT(DISTINCT tt.task_id) as task_count,
              COUNT(DISTINCT pt.prp_id) as prp_count
            FROM tags t
            LEFT JOIN task_tags tt ON t.id = tt.tag_id
            LEFT JOIN prp_tags pt ON t.id = pt.tag_id
            GROUP BY t.id
            ORDER BY (COUNT(DISTINCT tt.task_id) + COUNT(DISTINCT pt.prp_id)) DESC, t.name
          `;

          const formattedTags = tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            description: tag.description,
            color: tag.color,
            createdBy: tag.created_by,
            createdAt: tag.created_at,
            usage: {
              tasks: parseInt(tag.task_count),
              prps: parseInt(tag.prp_count),
              total: parseInt(tag.task_count) + parseInt(tag.prp_count),
            },
          }));

          return createSuccessResponse("Tags retrieved successfully", {
            tags: formattedTags,
            stats: {
              totalTags: tags.length,
              totalUsage: formattedTags.reduce((sum, tag) => sum + tag.usage.total, 0),
            },
          });
        });
      } catch (error) {
        console.error("List tags error:", error);
        return createErrorResponse(`Failed to list tags: ${(error as any).message}`);
      }
    },
  );
}