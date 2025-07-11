/**
 * PRP parsing MCP tools
 * Handles Product Requirements Prompt parsing and task generation for AI coding assistants
 */

import { withDatabase } from "../../database";
import { 
  Schemas, 
  Props, 
  Env, 
  TaskStatus,
  TaskGenerationConfig,
  TaskPriority,
  DEFAULT_ANTHROPIC_MODEL
} from "../types";
import { 
  createErrorResponse, 
  createSuccessResponse 
} from "../utils/response-utils";
import { PRPParser } from "../parsers/prp-parser";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPRPTools(server: McpServer, env: Env, props: Props) {
  
  // Tool: Parse PRP to generate implementation tasks
  server.tool(
    "parse-prp",
    "Parse a Product Requirements Prompt and generate concrete implementation tasks for AI coding assistants.",
    Schemas.ParsePRP.shape,
    async ({ projectId, prpContent, generateMilestones, maxTasks, overwriteExisting }) => {
      try {
        // Validate PRP content
        const validation = PRPParser.validatePRPContent(prpContent);
        if (!validation.isValid) {
          return createErrorResponse(
            'Invalid PRP content',
            { errors: validation.errors }
          );
        }

        // Sanitize PRP content
        const sanitizedContent = PRPParser.sanitizePRPContent(prpContent);

        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Check if project exists and user has access
          const projects = await db`
            SELECT * FROM projects 
            WHERE id = ${projectId} AND user_id = ${props.login}
          `;

          if (projects.length === 0) {
            return createErrorResponse('Project not found or access denied');
          }

          const project = projects[0];

          // Check for existing tasks if not overwriting
          if (!overwriteExisting) {
            const existingTasks = await db`
              SELECT COUNT(*) as count FROM tasks 
              WHERE project_id = ${projectId}
            `;

            if (parseInt(existingTasks[0].count) > 0) {
              return createErrorResponse(
                'Project already has tasks. Use overwriteExisting=true to replace them.',
                { 
                  existingTaskCount: parseInt(existingTasks[0].count),
                  suggestion: 'Set overwriteExisting=true to replace existing tasks'
                }
              );
            }
          }

          // Delete existing tasks if overwriting
          if (overwriteExisting) {
            await db`DELETE FROM tasks WHERE project_id = ${projectId}`;
          }

          // Initialize PRP parser
          const parser = new PRPParser(
            env.ANTHROPIC_API_KEY,
            env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
          );

          // Create task generation configuration
          const config: TaskGenerationConfig = {
            maxTasks: maxTasks || 10,
            includeMilestones: generateMilestones || false,
            defaultPriority: TaskPriority.MEDIUM,
            estimateHours: true,
            generateDependencies: false
          };

          // Generate implementation tasks from PRP
          const aiTasks = await parser.generateTasksFromPRP(
            sanitizedContent,
            project.context || {},
            config
          );

          // Insert tasks into database
          const insertedTasks = [];
          for (const task of aiTasks) {
            const insertedTask = await db`
              INSERT INTO tasks (
                project_id, title, description, status, priority, 
                estimated_hours, assignee, dependencies, notes
              ) VALUES (
                ${projectId}, ${task.title}, ${task.description}, ${TaskStatus.TODO}, 
                ${task.priority}, ${task.estimatedHours || null}, ${null}, 
                ${task.dependencies || null}, ${null}
              ) RETURNING *
            `;
            insertedTasks.push(insertedTask[0]);
          }

          // Update project with PRP content
          await db`
            UPDATE projects 
            SET prp_content = ${sanitizedContent}, updated_at = NOW()
            WHERE id = ${projectId}
          `;

          // Return success response
          return createSuccessResponse(
            'PRP parsed successfully and implementation tasks generated',
            {
              projectId,
              projectName: project.name,
              prpContentLength: sanitizedContent.length,
              tasksGenerated: insertedTasks.length,
              milestonesIncluded: generateMilestones,
              aiModel: env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
              validationGates: ['tests', 'type-check', 'lint'],
              implementationFocus: 'AI coding assistant optimized',
              nextSteps: [
                `Use task-list --projectId="${projectId}" to view generated tasks`,
                `Use task-next --projectId="${projectId}" to get the next recommended implementation task`,
                'Run validation gates (tests, type checking) after each task completion'
              ]
            }
          );
        });

      } catch (error) {
        console.error('PRP parsing failed:', error);
        return createErrorResponse(
          'Failed to parse PRP',
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }
  );
}