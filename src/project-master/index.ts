/**
 * Project Master MCP Server
 * Main entry point for the AI-powered project and task management MCP server
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import OAuthProvider from "@cloudflare/workers-oauth-provider";

// Import tool registration functions
import { registerProjectTools } from "./tools/project-tools";
import { registerPRPTools } from "./tools/prp-tools";
import { registerTaskTools } from "./tools/task-tools";
import { registerResearchTools } from "./tools/research-tools";

// Import types
import { Props, Env, ALLOWED_USERNAMES } from "./types";

// Import database utilities
import { closeDb } from "../database";

// Import GitHub OAuth handler
import { GitHubHandler } from "../github-handler";

export class ProjectMasterMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "Project Master MCP Server",
    version: "1.0.0",
  });

  /**
   * Clean up database connections when Durable Object is shutting down
   */
  async cleanup(): Promise<void> {
    try {
      await closeDb();
      console.log('Database connections closed successfully');
    } catch (error) {
      console.error('Error during database cleanup:', error);
    }
  }

  /**
   * Handle Durable Object alarms - used for cleanup
   */
  async alarm(): Promise<void> {
    console.log('Alarm triggered - cleaning up resources');
    await this.cleanup();
  }

  /**
   * Initialize the MCP server with all tools
   */
  async init() {
    try {
      // Log initialization
      console.log(`Project Master MCP initialized for user: ${this.props.login} (${this.props.name})`);
      console.log(`User has ${ALLOWED_USERNAMES.has(this.props.login) ? "privileged" : "standard"} access`);

      // Register all tool groups
      this.registerAllTools();

      console.log(`Project Master MCP Server initialized with all tools for ${this.props.login}`);
    } catch (error) {
      console.error('Error during Project Master MCP initialization:', error);
      throw error;
    }
  }

  /**
   * Register all tool groups
   */
  private registerAllTools() {
    // Project management tools - available to all authenticated users
    registerProjectTools(this.server, this.env, this.props);

    // PRP parsing tools - available to all authenticated users
    registerPRPTools(this.server, this.env, this.props);

    // Task management tools - some restricted to privileged users
    registerTaskTools(this.server, this.env, this.props);

    // Research and analytics tools - available to all authenticated users
    registerResearchTools(this.server, this.env, this.props);

    console.log('All tool groups registered successfully');
  }
}

// Export with backward compatibility
export { ProjectMasterMCP as MyMCP };

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