/**
 * PRP Parser MCP Server
 * Main entry point for the Product Requirement Prompt parsing MCP server
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";

// Import tools
import { registerParsePRPTool } from "./tools/parse-prp";
import { registerTaskCRUDTools } from "./tools/task-crud";
import { registerDocumentationTools } from "./tools/documentation-crud";
import { registerTagTools } from "./tools/tag-management";
import { registerSearchTools } from "./tools/search-tools";

// Import types
import { Props, Env } from "./types";

// Import database utilities
import { closeDb } from "../database";

// Import GitHub OAuth handler
import { GitHubHandler } from "../github-handler";

// Privileged users who can perform write operations
const ALLOWED_USERNAMES = new Set<string>(["coleam00"]);

export class PRPParserMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "PRP Parser MCP Server",
    version: "1.0.0",
  });

  /**
   * Clean up database connections
   */
  async cleanup(): Promise<void> {
    try {
      await closeDb();
      console.log("Database connections closed successfully");
    } catch (error) {
      console.error("Error during database cleanup:", error);
    }
  }

  /**
   * Handle Durable Object alarms
   */
  async alarm(): Promise<void> {
    console.log("Alarm triggered - cleaning up resources");
    await this.cleanup();
  }

  /**
   * Initialize the MCP server with all tools
   */
  async init() {
    try {
      // Log initialization
      console.log(`PRP Parser MCP initialized for user: ${this.props.login} (${this.props.name})`);
      console.log(`User has ${ALLOWED_USERNAMES.has(this.props.login) ? "privileged" : "standard"} access`);

      // Register parsing tool - available to all authenticated users
      registerParsePRPTool(this.server, this.env, this.props);

      // Register CRUD tools - some restricted to privileged users
      registerTaskCRUDTools(this.server, this.env, this.props);
      registerDocumentationTools(this.server, this.env, this.props);
      registerTagTools(this.server, this.env, this.props);

      // Register search tools - available to all authenticated users
      registerSearchTools(this.server, this.env, this.props);

      console.log(`PRP Parser MCP Server initialized with all tools for ${this.props.login}`);
    } catch (error) {
      console.error("Error during PRP Parser MCP initialization:", error);
      throw error;
    }
  }
}

// Export Durable Object class
export { PRPParserMCP as MyMCP } from "./index";

// Export OAuth provider with MCP endpoints
export default new OAuthProvider({
  apiHandlers: {
    "/sse": PRPParserMCP.serveSSE("/sse") as any,
    "/mcp": PRPParserMCP.serve("/mcp") as any,
  },
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: GitHubHandler as any,
  tokenEndpoint: "/token",
});