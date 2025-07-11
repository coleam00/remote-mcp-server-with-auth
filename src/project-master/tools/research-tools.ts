/**
 * Research and analytics MCP tools
 * Handles project research and context management
 */

import { withDatabase } from "../../database";
import { 
  Schemas, 
  Props, 
  Env
} from "../types";
import { 
  createErrorResponse, 
  createSuccessResponse,
  createInfoResponse
} from "../utils/response-utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerResearchTools(server: McpServer, env: Env, props: Props) {
  
  // Tool: Project research
  server.tool(
    "project-research",
    "Conduct contextual research with project-specific information to help with development decisions.",
    Schemas.ProjectResearch.shape,
    async ({ projectId, query, includeContext, maxResults }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Verify project ownership
          const [project] = await db`
            SELECT * FROM projects 
            WHERE id = ${projectId} 
            AND user_id = ${props.login}
          `;

          if (!project) {
            return createErrorResponse('Project not found or access denied');
          }

          // This would integrate with AI research services
          // For now, return a helpful response with project context
          const contextText = includeContext && project.context ? 
            JSON.stringify(project.context, null, 2) : 'No context available';

          return createInfoResponse(
            `Research Results for: "${query}"`,
            `This is a placeholder for AI-powered research functionality. In a full implementation, this would:

1. **Analyze your project context and requirements**
2. **Search relevant documentation and resources** 
3. **Provide contextual recommendations**
4. **Suggest implementation approaches**

**Project:** ${project.name}
**Context:** ${includeContext ? 'Included' : 'Not included'}
**Max Results:** ${maxResults}

**Project Context:**
\`\`\`json
${contextText}
\`\`\`

**Current PRP Content:**
${project.prp_content ? project.prp_content.substring(0, 300) + '...' : 'No PRP content'}`,
            {
              note: "To enable full AI research capabilities, integrate with research APIs or expand the AI service integration.",
              possibleIntegrations: [
                "Web search APIs (Google, Bing)",
                "Documentation search (GitHub, Stack Overflow)",
                "AI-powered analysis with Anthropic Claude",
                "Knowledge base integration"
              ]
            }
          );
        });
      } catch (error) {
        console.error('Project research error:', error);
        return createErrorResponse('Failed to conduct research', { 
          error: (error as any).message 
        });
      }
    }
  );

  // Tool: Project context management
  server.tool(
    "project-context",
    "Get or update the project context for enhanced AI assistance and project understanding.",
    Schemas.ProjectContext.shape,
    async ({ projectId, context, append }) => {
      try {
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Verify project ownership
          const [project] = await db`
            SELECT * FROM projects 
            WHERE id = ${projectId} 
            AND user_id = ${props.login}
          `;

          if (!project) {
            return createErrorResponse('Project not found or access denied');
          }

          if (context) {
            // Update context
            const currentContext = project.context || {};
            const newContext = append ? 
              { ...currentContext, ...context } : 
              context;

            await db`
              UPDATE projects 
              SET context = ${JSON.stringify(newContext)}, 
                  updated_at = NOW()
              WHERE id = ${projectId}
            `;

            console.log(`Project context updated: ${projectId} by ${props.login}`);

            return createSuccessResponse("Project context updated", {
              projectName: project.name,
              action: append ? 'Appended to existing context' : 'Replaced context',
              updatedContext: newContext,
              usage: "Project context helps AI tools provide better assistance by understanding your technology stack, coding standards, business requirements, and team workflows."
            });
          } else {
            // Get current context
            return createInfoResponse(
              "Project Context",
              `**Project:** ${project.name}
**ID:** ${projectId}

**Current Context:**
\`\`\`json
${JSON.stringify(project.context || {}, null, 2)}
\`\`\`

**Update Context:**
Use \`project-context --projectId="${projectId}" --context='{"key": "value"}'\` to update context.

**Example Context:**
\`\`\`json
{
  "tech_stack": ["React", "TypeScript", "Node.js"],
  "coding_standards": "ESLint + Prettier",
  "target_audience": "Enterprise users",
  "deployment": "AWS Lambda",
  "database": "PostgreSQL",
  "testing_framework": "Jest",
  "ci_cd": "GitHub Actions"
}
\`\`\``,
              {
                contextKeys: Object.keys(project.context || {}),
                lastUpdated: project.updated_at
              }
            );
          }
        });
      } catch (error) {
        console.error('Project context error:', error);
        return createErrorResponse('Failed to manage project context', { 
          error: (error as any).message 
        });
      }
    }
  );
}