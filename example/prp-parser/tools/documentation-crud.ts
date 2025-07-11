/**
 * Documentation CRUD operations for MCP tools
 * Manages PRP documentation references and content
 */

import { withDatabase } from "../../database";
import {
  CreateDocumentationSchema,
  UpdateDocumentationSchema,
  GetDocumentationSchema,
  Props,
  Env,
  createErrorResponse,
  createSuccessResponse,
} from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Privileged users who can perform write operations
const ALLOWED_USERNAMES = new Set<string>(["coleam00"]);

export function registerDocumentationTools(server: McpServer, env: Env, props: Props) {
  const isPrivileged = ALLOWED_USERNAMES.has(props.login);

  // Create Documentation - Privileged users only
  if (isPrivileged) {
    server.tool(
      "createDocumentation",
      "Create a new documentation reference for a PRP. Requires write permissions.",
      CreateDocumentationSchema.shape,
      async ({ prpId, type, path, why, section, critical }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify PRP exists
            const prpCheck = await db`
              SELECT id, name FROM prps WHERE id = ${prpId}
            `;

            if (prpCheck.length === 0) {
              return createErrorResponse("PRP not found", { prpId });
            }

            // Check for duplicate documentation
            const existingDoc = await db`
              SELECT id FROM prp_documentation
              WHERE prp_id = ${prpId} AND doc_type = ${type} AND path = ${path}
            `;

            if (existingDoc.length > 0) {
              return createErrorResponse("Documentation already exists", {
                prpId,
                type,
                path,
                existingId: existingDoc[0].id,
              });
            }

            // Create documentation
            const docResult = await db`
              INSERT INTO prp_documentation (
                prp_id, doc_type, path, why, section, critical_level
              ) VALUES (
                ${prpId}, ${type}, ${path}, ${why || null},
                ${section || null}, ${critical || null}
              )
              RETURNING id, created_at
            `;

            const docId = docResult[0].id;

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                'documentation', ${docId}, 'create', ${props.login},
                ${JSON.stringify({ prpId, type, path })}
              )
            `;

            console.log(`Documentation created: ${docId} by ${props.login}`);

            return createSuccessResponse("Documentation reference created successfully", {
              documentationId: docId,
              prpName: prpCheck[0].name,
              type,
              path,
              createdAt: docResult[0].created_at,
            });
          });
        } catch (error) {
          console.error("Create documentation error:", error);
          return createErrorResponse(`Failed to create documentation: ${(error as any).message}`);
        }
      },
    );
  }

  // Update Documentation - Privileged users only
  if (isPrivileged) {
    server.tool(
      "updateDocumentation",
      "Update an existing documentation reference. Requires write permissions.",
      UpdateDocumentationSchema.shape,
      async ({ id, why, section, critical }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get current documentation
            const currentDoc = await db`
              SELECT * FROM prp_documentation WHERE id = ${id}
            `;

            if (currentDoc.length === 0) {
              return createErrorResponse("Documentation not found", { documentationId: id });
            }

            // Build update query dynamically
            const updates: any = {};
            const changes: any = {};

            if (why !== undefined) {
              updates.why = why;
              changes.why = { from: currentDoc[0].why, to: why };
            }

            if (section !== undefined) {
              updates.section = section;
              changes.section = { from: currentDoc[0].section, to: section };
            }

            if (critical !== undefined) {
              updates.critical_level = critical;
              changes.critical = { from: currentDoc[0].critical_level, to: critical };
            }

            // Update if there are changes
            if (Object.keys(updates).length > 0) {
              await db`
                UPDATE prp_documentation
                SET ${db(updates)}
                WHERE id = ${id}
              `;

              // Add audit log
              await db`
                INSERT INTO prp_audit_log (
                  entity_type, entity_id, action, changed_by, changes
                ) VALUES (
                  'documentation', ${id}, 'update', ${props.login},
                  ${JSON.stringify(changes)}
                )
              `;

              console.log(`Documentation updated: ${id} by ${props.login}`);

              return createSuccessResponse("Documentation updated successfully", {
                documentationId: id,
                changes: Object.keys(changes),
              });
            } else {
              return createSuccessResponse("No changes to update", { documentationId: id });
            }
          });
        } catch (error) {
          console.error("Update documentation error:", error);
          return createErrorResponse(`Failed to update documentation: ${(error as any).message}`);
        }
      },
    );
  }

  // Get Documentation - Available to all authenticated users
  server.tool(
    "getDocumentation",
    "Retrieve documentation references with filtering and pagination",
    GetDocumentationSchema.shape,
    async ({ prpId, type, limit, offset }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Build dynamic query
          let query = db`
            SELECT
              d.id,
              d.prp_id,
              d.doc_type,
              d.path,
              d.why,
              d.section,
              d.critical_level,
              d.created_at,
              p.name as prp_name,
              p.description as prp_description
            FROM prp_documentation d
            JOIN prps p ON d.prp_id = p.id
            WHERE 1=1
          `;

          // Apply filters
          if (prpId) {
            query = db`${query} AND d.prp_id = ${prpId}`;
          }

          if (type) {
            query = db`${query} AND d.doc_type = ${type}`;
          }

          // Add ordering and pagination
          query = db`${query}
            ORDER BY d.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;

          const documentation = await query;

          // Get total count
          let countQuery = db`
            SELECT COUNT(*) as total
            FROM prp_documentation d
            WHERE 1=1
          `;

          if (prpId) {
            countQuery = db`${countQuery} AND d.prp_id = ${prpId}`;
          }

          if (type) {
            countQuery = db`${countQuery} AND d.doc_type = ${type}`;
          }

          const totalResult = await countQuery;
          const total = parseInt(totalResult[0].total);

          // Group documentation by PRP if not filtering by specific PRP
          let grouped: any = {};
          if (!prpId) {
            documentation.forEach((doc: any) => {
              if (!grouped[doc.prp_id]) {
                grouped[doc.prp_id] = {
                  prpId: doc.prp_id,
                  prpName: doc.prp_name,
                  prpDescription: doc.prp_description,
                  documentation: [],
                };
              }
              grouped[doc.prp_id].documentation.push({
                id: doc.id,
                type: doc.doc_type,
                path: doc.path,
                why: doc.why,
                section: doc.section,
                critical: doc.critical_level,
                createdAt: doc.created_at,
              });
            });
          }

          const result = prpId
            ? {
                prpId: prpId,
                documentation: documentation.map((doc) => ({
                  id: doc.id,
                  type: doc.doc_type,
                  path: doc.path,
                  why: doc.why,
                  section: doc.section,
                  critical: doc.critical_level,
                  createdAt: doc.created_at,
                })),
                pagination: {
                  total,
                  limit,
                  offset,
                  hasMore: offset + limit < total,
                },
              }
            : {
                prps: Object.values(grouped),
                pagination: {
                  total,
                  limit,
                  offset,
                  hasMore: offset + limit < total,
                },
              };

          return createSuccessResponse("Documentation retrieved successfully", result);
        });
      } catch (error) {
        console.error("Get documentation error:", error);
        return createErrorResponse(`Failed to retrieve documentation: ${(error as any).message}`);
      }
    },
  );

  // Delete Documentation - Privileged users only
  if (isPrivileged) {
    server.tool(
      "deleteDocumentation",
      "Delete a documentation reference. Requires write permissions.",
      {
        id: {
          type: "string",
          description: "Documentation ID to delete",
        },
      },
      async ({ id }) => {
        try {
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Check documentation exists
            const docCheck = await db`
              SELECT id, path, doc_type FROM prp_documentation WHERE id = ${id}
            `;

            if (docCheck.length === 0) {
              return createErrorResponse("Documentation not found", { documentationId: id });
            }

            // Delete documentation
            await db`DELETE FROM prp_documentation WHERE id = ${id}`;

            // Add audit log
            await db`
              INSERT INTO prp_audit_log (
                entity_type, entity_id, action, changed_by, changes
              ) VALUES (
                'documentation', ${id}, 'delete', ${props.login},
                ${JSON.stringify({
                  path: docCheck[0].path,
                  type: docCheck[0].doc_type,
                })}
              )
            `;

            console.log(`Documentation deleted: ${id} by ${props.login}`);

            return createSuccessResponse("Documentation deleted successfully", {
              documentationId: id,
            });
          });
        } catch (error) {
          console.error("Delete documentation error:", error);
          return createErrorResponse(`Failed to delete documentation: ${(error as any).message}`);
        }
      },
    );
  }

  // List Documentation Types - Available to all authenticated users
  server.tool(
    "listDocumentationTypes",
    "List all unique documentation types used in the system",
    {},
    async () => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          const types = await db`
            SELECT DISTINCT doc_type, COUNT(*) as count
            FROM prp_documentation
            GROUP BY doc_type
            ORDER BY count DESC
          `;

          const stats = await db`
            SELECT
              COUNT(DISTINCT prp_id) as total_prps,
              COUNT(*) as total_docs,
              COUNT(DISTINCT path) as unique_paths
            FROM prp_documentation
          `;

          return createSuccessResponse("Documentation types retrieved", {
            types: types.map((t) => ({
              type: t.doc_type,
              count: parseInt(t.count),
            })),
            stats: {
              totalPRPs: parseInt(stats[0].total_prps),
              totalDocuments: parseInt(stats[0].total_docs),
              uniquePaths: parseInt(stats[0].unique_paths),
            },
          });
        });
      } catch (error) {
        console.error("List documentation types error:", error);
        return createErrorResponse(`Failed to list documentation types: ${(error as any).message}`);
      }
    },
  );
}