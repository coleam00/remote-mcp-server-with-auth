/**
 * PRP parsing MCP tool implementation
 * Parses Product Requirement Prompts using Claude AI
 */

import { withDatabase } from "../../database";
import { PRPParser } from "../parsers/prp-parser";
import { PRPValidator } from "../parsers/validation";
import { TaskExtractor } from "../parsers/task-extractor";
import { ParsePRPSchema, Props, Env, createErrorResponse, createSuccessResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerParsePRPTool(server: McpServer, env: Env, props: Props) {
  server.tool(
    "parsePRP",
    "Parse a PRP markdown file and extract structured information using Claude AI. Extracts tasks, documentation, goals, and success criteria.",
    ParsePRPSchema.shape,
    async ({ prpContent, extractTasks, extractDocs, saveToDB }) => {
      try {
        // Validate PRP content first
        console.log(`Validating PRP content for user: ${props.login}`);
        const contentValidation = PRPValidator.validatePRPContent(prpContent);

        if (!contentValidation.valid) {
          return createErrorResponse("Invalid PRP format", {
            errors: contentValidation.errors,
            warnings: contentValidation.warnings,
          });
        }

        // Sanitize content
        const sanitizedContent = PRPValidator.sanitizePRPContent(prpContent);

        // Initialize parser with API key
        const parser = new PRPParser(env.ANTHROPIC_API_KEY);

        // Parse PRP content
        console.log(`Parsing PRP with Claude for user: ${props.login}`);
        const startTime = Date.now();
        const parsed = await parser.parsePRP(sanitizedContent);
        const parseTime = Date.now() - startTime;

        // Validate parsed structure
        const parsedValidation = PRPValidator.validateParsedPRP(parsed);
        if (!parsedValidation.valid) {
          return createErrorResponse("Parsed PRP structure is invalid", {
            errors: parsedValidation.errors,
            warnings: parsedValidation.warnings,
            parsed: parsed,
          });
        }

        // Process tasks if requested
        let processedTasks: any[] = [];
        if (extractTasks && parsed.tasks.length > 0) {
          processedTasks = TaskExtractor.processTasks(parsed.tasks, parsed.goal);
        }

        // Save to database if requested
        let savedPRPId = null;
        if (saveToDB) {
          const dbResult = await withDatabase(env.DATABASE_URL, async (db) => {
            try {
              // Start transaction
              const prpResult = await db`
                INSERT INTO prps (
                  name, description, goal, why, what,
                  success_criteria, context, created_by
                ) VALUES (
                  ${parsed.name}, 
                  ${parsed.description}, 
                  ${parsed.goal},
                  ${JSON.stringify(parsed.why)}, 
                  ${parsed.what},
                  ${JSON.stringify(parsed.successCriteria)},
                  ${JSON.stringify(parsed.context)}, 
                  ${props.login}
                )
                RETURNING id, created_at
              `;

              const prpId = prpResult[0].id;
              console.log(`Created PRP with ID: ${prpId}`);

              // Insert tasks if requested
              if (extractTasks && processedTasks.length > 0) {
                const taskData = processedTasks.map((task) => ({
                  prp_id: prpId,
                  task_order: task.order,
                  description: task.description,
                  file_to_modify: task.fileToModify || null,
                  pattern: task.pattern || null,
                  pseudocode: task.pseudocode || null,
                  status: "pending",
                  additional_info: { context: task.context },
                }));

                await db`
                  INSERT INTO tasks ${db(taskData)}
                `;
                console.log(`Inserted ${processedTasks.length} tasks`);
              }

              // Insert documentation references if requested
              if (extractDocs && parsed.context.documentation.length > 0) {
                const docData = parsed.context.documentation.map((doc) => ({
                  prp_id: prpId,
                  doc_type: doc.type,
                  path: doc.path,
                  why: doc.why,
                  section: doc.section || null,
                  critical_level: doc.critical || null,
                }));

                await db`
                  INSERT INTO prp_documentation ${db(docData)}
                `;
                console.log(`Inserted ${parsed.context.documentation.length} documentation references`);
              }

              // Add audit log entry
              await db`
                INSERT INTO prp_audit_log (
                  entity_type, entity_id, action, changed_by, changes
                ) VALUES (
                  'prp', ${prpId}, 'create', ${props.login},
                  ${JSON.stringify({ source: "parsePRP", parseTime: parseTime })}
                )
              `;

              return { prpId, createdAt: prpResult[0].created_at };
            } catch (dbError) {
              console.error("Database error during PRP save:", dbError);
              throw dbError;
            }
          });

          savedPRPId = dbResult.prpId;
        }

        // Prepare response
        const response: any = {
          prp: {
            id: savedPRPId,
            name: parsed.name,
            description: parsed.description,
            goal: parsed.goal,
            why: parsed.why,
            what: parsed.what,
            successCriteria: parsed.successCriteria,
          },
          stats: {
            tasksExtracted: processedTasks.length,
            documentationReferences: parsed.context.documentation.length,
            parseTimeMs: parseTime,
            savedToDatabase: saveToDB,
          },
          validation: {
            warnings: parsedValidation.warnings,
          },
        };

        if (extractTasks) {
          response.tasks = processedTasks;
        }

        if (extractDocs) {
          response.documentation = parsed.context.documentation;
        }

        return createSuccessResponse(
          `PRP parsed successfully${savedPRPId ? ` and saved with ID: ${savedPRPId}` : ""}`,
          response,
        );
      } catch (error) {
        console.error("PRP parsing error:", error);

        // Handle specific error types
        if ((error as any).name === "PRPParseError") {
          return createErrorResponse("Failed to parse PRP", {
            type: (error as any).name,
            message: (error as any).message,
            details: (error as any).details,
          });
        }

        if ((error as any).message && (error as any).message.includes("ANTHROPIC_API_KEY")) {
          return createErrorResponse("Anthropic API key not configured", {
            hint: "Please set ANTHROPIC_API_KEY in environment variables",
          });
        }

        if ((error as any).message && (error as any).message.includes("rate limit")) {
          return createErrorResponse("API rate limit reached", {
            hint: "Please try again later",
          });
        }

        // Generic error
        return createErrorResponse(`Failed to parse PRP: ${(error as any).message || "Unknown error"}`);
      }
    },
  );
}