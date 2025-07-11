/**
 * Search functionality for MCP tools
 * Provides advanced search capabilities for PRPs and tasks
 */

import { withDatabase } from "../../database";
import { SearchPRPsSchema, Props, Env, createErrorResponse, createSuccessResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSearchTools(server: McpServer, env: Env, props: Props) {
  // Search PRPs - Available to all authenticated users
  server.tool(
    "searchPRPs",
    "Search for PRPs using full-text search and filters",
    SearchPRPsSchema.shape,
    async ({ query, createdBy, tags, fromDate, toDate, limit, offset }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Build dynamic query
          let conditions = [];
          let params: any = {};

          if (query) {
            // Use PostgreSQL full-text search
            conditions.push(`
              to_tsvector('english', p.name || ' ' || p.description || ' ' || p.goal || ' ' || p.what) 
              @@ plainto_tsquery('english', ${query})
            `);
          }

          if (createdBy) {
            conditions.push(`p.created_by = ${createdBy}`);
          }

          if (fromDate) {
            conditions.push(`p.created_at >= ${fromDate}`);
          }

          if (toDate) {
            conditions.push(`p.created_at <= ${toDate}`);
          }

          // Build the main query
          let searchQuery = db`
            SELECT DISTINCT
              p.id,
              p.name,
              p.description,
              p.goal,
              p.created_by,
              p.created_at,
              p.updated_at,
              array_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL) as tags,
              COUNT(DISTINCT task.id) as task_count,
              COUNT(DISTINCT task.id) FILTER (WHERE task.status = 'completed') as completed_tasks,
              COUNT(DISTINCT d.id) as doc_count
            FROM prps p
            LEFT JOIN prp_tags pt ON p.id = pt.prp_id
            LEFT JOIN tags t ON pt.tag_id = t.id
            LEFT JOIN tasks task ON p.id = task.prp_id AND task.deleted_at IS NULL
            LEFT JOIN prp_documentation d ON p.id = d.prp_id
          `;

          // Add WHERE clause if there are conditions
          if (conditions.length > 0 || (tags && tags.length > 0)) {
            searchQuery = db`${searchQuery} WHERE `;

            if (conditions.length > 0) {
              searchQuery = db`${searchQuery} ${db.unsafe(conditions.join(" AND "))}`;
            }

            if (tags && tags.length > 0) {
              if (conditions.length > 0) {
                searchQuery = db`${searchQuery} AND `;
              }
              searchQuery = db`${searchQuery} EXISTS (
                SELECT 1 FROM prp_tags pt2
                JOIN tags t2 ON pt2.tag_id = t2.id
                WHERE pt2.prp_id = p.id AND t2.name = ANY(${tags})
              )`;
            }
          }

          // Add grouping, ordering, and pagination
          searchQuery = db`${searchQuery}
            GROUP BY p.id
            ORDER BY 
              ${query ? db`ts_rank(to_tsvector('english', p.name || ' ' || p.description || ' ' || p.goal || ' ' || p.what), plainto_tsquery('english', ${query})) DESC,` : db``}
              p.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;

          const prps = await searchQuery;

          // Get total count
          let countQuery = db`
            SELECT COUNT(DISTINCT p.id) as total
            FROM prps p
            LEFT JOIN prp_tags pt ON p.id = pt.prp_id
            LEFT JOIN tags t ON pt.tag_id = t.id
          `;

          if (conditions.length > 0 || (tags && tags.length > 0)) {
            countQuery = db`${countQuery} WHERE `;

            if (conditions.length > 0) {
              countQuery = db`${countQuery} ${db.unsafe(conditions.join(" AND "))}`;
            }

            if (tags && tags.length > 0) {
              if (conditions.length > 0) {
                countQuery = db`${countQuery} AND `;
              }
              countQuery = db`${countQuery} EXISTS (
                SELECT 1 FROM prp_tags pt2
                JOIN tags t2 ON pt2.tag_id = t2.id
                WHERE pt2.prp_id = p.id AND t2.name = ANY(${tags})
              )`;
            }
          }

          const totalResult = await countQuery;
          const total = parseInt(totalResult[0].total);

          // Format results
          const formattedPRPs = prps.map((prp) => ({
            id: prp.id,
            name: prp.name,
            description: prp.description,
            goal: prp.goal,
            createdBy: prp.created_by,
            createdAt: prp.created_at,
            updatedAt: prp.updated_at,
            tags: prp.tags || [],
            stats: {
              totalTasks: parseInt(prp.task_count),
              completedTasks: parseInt(prp.completed_tasks),
              documentationCount: parseInt(prp.doc_count),
              completionRate:
                parseInt(prp.task_count) > 0
                  ? Math.round((parseInt(prp.completed_tasks) / parseInt(prp.task_count)) * 100)
                  : 0,
            },
          }));

          return createSuccessResponse("PRPs searched successfully", {
            prps: formattedPRPs,
            searchCriteria: {
              query,
              createdBy,
              tags,
              fromDate,
              toDate,
            },
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total,
            },
          });
        });
      } catch (error) {
        console.error("Search PRPs error:", error);
        return createErrorResponse(`Failed to search PRPs: ${(error as any).message}`);
      }
    },
  );

  // Search Tasks - Available to all authenticated users
  server.tool(
    "searchTasks",
    "Search for tasks across all PRPs with advanced filters",
    {
      query: {
        type: "string",
        description: "Full-text search query",
      },
      status: {
        type: "string",
        enum: ["pending", "in_progress", "completed"],
        description: "Filter by task status",
      },
      prpName: {
        type: "string",
        description: "Filter by PRP name (partial match)",
      },
      fileToModify: {
        type: "string",
        description: "Filter by file path (partial match)",
      },
      hasPattern: {
        type: "boolean",
        description: "Filter tasks that have patterns defined",
      },
      hasPseudocode: {
        type: "boolean",
        description: "Filter tasks that have pseudocode",
      },
      complexity: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Filter by estimated complexity",
      },
      limit: {
        type: "number",
        description: "Maximum results to return",
        default: 20,
      },
      offset: {
        type: "number",
        description: "Offset for pagination",
        default: 0,
      },
    },
    async ({ query, status, prpName, fileToModify, hasPattern, hasPseudocode, complexity, limit, offset }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Build dynamic query
          let conditions = ["t.deleted_at IS NULL"];

          if (query) {
            conditions.push(`
              to_tsvector('english', t.description || ' ' || COALESCE(t.pattern, '') || ' ' || COALESCE(t.pseudocode, ''))
              @@ plainto_tsquery('english', ${query})
            `);
          }

          if (status) {
            conditions.push(`t.status = ${status}`);
          }

          if (prpName) {
            conditions.push(`p.name ILIKE ${"%" + prpName + "%"}`);
          }

          if (fileToModify) {
            conditions.push(`t.file_to_modify ILIKE ${"%" + fileToModify + "%"}`);
          }

          if (hasPattern === true) {
            conditions.push(`t.pattern IS NOT NULL AND t.pattern != ''`);
          } else if (hasPattern === false) {
            conditions.push(`(t.pattern IS NULL OR t.pattern = '')`);
          }

          if (hasPseudocode === true) {
            conditions.push(`t.pseudocode IS NOT NULL AND t.pseudocode != ''`);
          } else if (hasPseudocode === false) {
            conditions.push(`(t.pseudocode IS NULL OR t.pseudocode = '')`);
          }

          // Complexity filter (estimated based on description length and details)
          if (complexity) {
            switch (complexity) {
              case "low":
                conditions.push(`(LENGTH(t.description) < 100 AND t.pattern IS NULL AND t.pseudocode IS NULL)`);
                break;
              case "medium":
                conditions.push(
                  `(LENGTH(t.description) BETWEEN 100 AND 200 OR (t.pattern IS NOT NULL AND LENGTH(t.pattern) < 100))`,
                );
                break;
              case "high":
                conditions.push(
                  `(LENGTH(t.description) > 200 OR LENGTH(COALESCE(t.pattern, '')) > 100 OR LENGTH(COALESCE(t.pseudocode, '')) > 50)`,
                );
                break;
            }
          }

          // Build the main query
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

          const tasks = await db.unsafe(`
            SELECT
              t.id,
              t.prp_id,
              t.task_order,
              t.description,
              t.file_to_modify,
              t.pattern,
              t.pseudocode,
              t.status,
              t.additional_info,
              t.created_at,
              t.updated_at,
              p.name as prp_name,
              p.created_by as prp_created_by,
              array_agg(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tags
              ${query ? `, ts_rank(to_tsvector('english', t.description || ' ' || COALESCE(t.pattern, '') || ' ' || COALESCE(t.pseudocode, '')), plainto_tsquery('english', $1)) as relevance` : ""}
            FROM tasks t
            JOIN prps p ON t.prp_id = p.id
            LEFT JOIN task_tags tt ON t.id = tt.task_id
            LEFT JOIN tags tg ON tt.tag_id = tg.id
            ${whereClause}
            GROUP BY t.id, p.name, p.created_by
            ORDER BY 
              ${query ? "relevance DESC," : ""}
              t.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `, query ? [query] : []);

          // Get total count
          const countResult = await db.unsafe(`
            SELECT COUNT(DISTINCT t.id) as total
            FROM tasks t
            JOIN prps p ON t.prp_id = p.id
            ${whereClause}
          `, query ? [query] : []);

          const total = parseInt(countResult[0].total);

          // Estimate complexity for each task
          const formattedTasks = tasks.map((task) => {
            let estimatedComplexity = "low";
            let complexityScore = 0;

            if (task.description.length > 200) complexityScore += 2;
            else if (task.description.length > 100) complexityScore += 1;

            if (task.pattern) complexityScore += 1;
            if (task.pseudocode) complexityScore += 1;
            if (task.file_to_modify && task.file_to_modify.includes("/")) complexityScore += 1;

            if (complexityScore >= 4) estimatedComplexity = "high";
            else if (complexityScore >= 2) estimatedComplexity = "medium";

            return {
              id: task.id,
              prpId: task.prp_id,
              prpName: task.prp_name,
              prpCreatedBy: task.prp_created_by,
              order: task.task_order,
              description: task.description,
              fileToModify: task.file_to_modify,
              hasPattern: !!task.pattern,
              hasPseudocode: !!task.pseudocode,
              status: task.status,
              tags: task.tags || [],
              estimatedComplexity,
              createdAt: task.created_at,
              updatedAt: task.updated_at,
              relevance: task.relevance || null,
            };
          });

          return createSuccessResponse("Tasks searched successfully", {
            tasks: formattedTasks,
            searchCriteria: {
              query,
              status,
              prpName,
              fileToModify,
              hasPattern,
              hasPseudocode,
              complexity,
            },
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total,
            },
          });
        });
      } catch (error) {
        console.error("Search tasks error:", error);
        return createErrorResponse(`Failed to search tasks: ${(error as any).message}`);
      }
    },
  );

  // Get PRP Summary - Available to all authenticated users
  server.tool(
    "getPRPSummary",
    "Get a comprehensive summary of a PRP including all related data",
    {
      prpId: {
        type: "string",
        description: "PRP ID to get summary for",
      },
    },
    async ({ prpId }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Get PRP details
          const prpResult = await db`
            SELECT
              p.*,
              array_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL) as tags
            FROM prps p
            LEFT JOIN prp_tags pt ON p.id = pt.prp_id
            LEFT JOIN tags t ON pt.tag_id = t.id
            WHERE p.id = ${prpId}
            GROUP BY p.id
          `;

          if (prpResult.length === 0) {
            return createErrorResponse("PRP not found", { prpId });
          }

          const prp = prpResult[0];

          // Get tasks
          const tasks = await db`
            SELECT
              t.*,
              array_agg(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tags
            FROM tasks t
            LEFT JOIN task_tags tt ON t.id = tt.task_id
            LEFT JOIN tags tg ON tt.tag_id = tg.id
            WHERE t.prp_id = ${prpId} AND t.deleted_at IS NULL
            GROUP BY t.id
            ORDER BY t.task_order
          `;

          // Get documentation
          const documentation = await db`
            SELECT * FROM prp_documentation
            WHERE prp_id = ${prpId}
            ORDER BY created_at
          `;

          // Get recent activity
          const recentActivity = await db`
            SELECT * FROM prp_audit_log
            WHERE (entity_type = 'prp' AND entity_id = ${prpId})
               OR (entity_type = 'task' AND entity_id IN (
                 SELECT id FROM tasks WHERE prp_id = ${prpId}
               ))
            ORDER BY created_at DESC
            LIMIT 10
          `;

          // Calculate statistics
          const taskStats = {
            total: tasks.length,
            pending: tasks.filter((t) => t.status === "pending").length,
            inProgress: tasks.filter((t) => t.status === "in_progress").length,
            completed: tasks.filter((t) => t.status === "completed").length,
            completionRate: tasks.length > 0 ? Math.round((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100) : 0,
          };

          return createSuccessResponse("PRP summary retrieved successfully", {
            prp: {
              id: prp.id,
              name: prp.name,
              description: prp.description,
              goal: prp.goal,
              why: prp.why,
              what: prp.what,
              successCriteria: prp.success_criteria,
              context: prp.context,
              tags: prp.tags || [],
              createdBy: prp.created_by,
              createdAt: prp.created_at,
              updatedAt: prp.updated_at,
            },
            tasks: tasks.map((t) => ({
              id: t.id,
              order: t.task_order,
              description: t.description,
              fileToModify: t.file_to_modify,
              status: t.status,
              tags: t.tags || [],
            })),
            documentation: documentation.map((d) => ({
              id: d.id,
              type: d.doc_type,
              path: d.path,
              why: d.why,
              section: d.section,
              critical: d.critical_level,
            })),
            statistics: {
              tasks: taskStats,
              documentation: documentation.length,
              tags: (prp.tags || []).length,
              daysActive: Math.floor((new Date().getTime() - new Date(prp.created_at).getTime()) / (1000 * 60 * 60 * 24)),
            },
            recentActivity: recentActivity.map((a) => ({
              action: a.action,
              entityType: a.entity_type,
              changedBy: a.changed_by,
              timestamp: a.created_at,
            })),
          });
        });
      } catch (error) {
        console.error("Get PRP summary error:", error);
        return createErrorResponse(`Failed to get PRP summary: ${(error as any).message}`);
      }
    },
  );
}