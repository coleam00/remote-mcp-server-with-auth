# Project Master MCP Server

An AI-powered project and task management MCP (Model Context Protocol) server with GitHub OAuth authentication and PostgreSQL database integration. This server enables AI assistants to help developers break down Product Requirements Prompts (PRPs) into actionable tasks, track project progress, and provide contextual research support throughout the development lifecycle.

## Features

### 🎯 **Project Management**
- Initialize and manage AI coding projects with structured workflows
- Parse PRPs and generate actionable development tasks with AI assistance
- Track project progress and maintain project-specific context

### 📋 **Task Management**
- List, prioritize, and track progress on project tasks
- Intelligent task recommendation based on dependencies and priority
- Time tracking with estimated vs actual hours
- Task status management (todo, in_progress, blocked, in_review, done)

### 🔒 **Security & Authentication**
- GitHub OAuth 2.0 integration with role-based access control
- User isolation (users only see their own projects)
- SQL injection protection and input validation
- Secure session management with HMAC-signed cookies

### 🤖 **AI Integration**
- Anthropic Claude integration for intelligent PRP parsing
- Context-aware task generation and project assistance
- Fallback parsing when AI services are unavailable

## MCP Tools Available

1. **`project-init`** - Initialize a new AI coding project
2. **`project-list`** - List all projects with filtering options
3. **`project-get`** - Get detailed project information
4. **`parse-prp`** - Parse PRP content and generate tasks using AI
5. **`task-list`** - List project tasks with filtering and sorting
6. **`task-get`** - Get detailed task information
7. **`task-update`** - Update task properties (status, priority, etc.)
8. **`task-complete`** - Mark tasks as completed with notes
9. **`task-next`** - Get intelligent next task recommendations
10. **`project-research`** - Conduct contextual research (placeholder)
11. **`project-context`** - Manage project context for AI assistance

## Prerequisites

- **Node.js** v20.0.0 or higher
- **npm** or **yarn** package manager
- **PostgreSQL** database (local or hosted)
- **GitHub OAuth App** (for authentication)
- **Anthropic API Key** (for AI features, optional)
- **Cloudflare Workers** account (for deployment)

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd remote-mcp-server-with-auth
npm install
```

### 2. Database Setup

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL locally
# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Create database
createdb project_master_db
```

#### Option B: Hosted PostgreSQL (Recommended)
Use a service like:
- [Supabase](https://supabase.com/) (Free tier available)
- [Railway](https://railway.app/)
- [Neon](https://neon.tech/)
- [Amazon RDS](https://aws.amazon.com/rds/)

### 3. GitHub OAuth App Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Project Master MCP
   - **Homepage URL**: `http://localhost:8788` (for development)
   - **Authorization callback URL**: `http://localhost:8788/callback`
4. Note the **Client ID** and **Client Secret**

### 4. Environment Configuration

Create/update the `.dev.vars` file in the project root:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Security
COOKIE_ENCRYPTION_KEY=your_64_character_hex_key

# AI Integration (Optional)
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-key

# Monitoring (Optional)
SENTRY_DSN=your_sentry_dsn_url
```

#### Generate Cookie Encryption Key
```bash
# Generate a secure 64-character hex key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Database Schema Migration

Run the database migration to create the required tables:

```bash
# Using psql directly
psql $DATABASE_URL < migrations/001_project_schema.sql

# Or connect to your database and run the migration
psql "postgresql://username:password@host:port/database" -f migrations/001_project_schema.sql
```

This creates:
- `projects` table with user isolation
- `tasks` table with dependency tracking
- `project_members` table for future team features
- Proper indexes and validation functions

### 6. Development Setup

#### Start the Development Server
```bash
# For Project Master MCP Server
wrangler dev --config wrangler-project-master.jsonc

# Server will be available at:
# - MCP endpoint: http://localhost:8788/mcp
# - OAuth authorization: http://localhost:8788/authorize
```

#### Alternative: Start the Original Database MCP
```bash
# For the original database MCP server
wrangler dev

# Available at: http://localhost:8788/mcp
```

### 7. Test with MCP Inspector

```bash
# Install and run MCP Inspector
npx @modelcontextprotocol/inspector@latest

# In the inspector:
# 1. Add server: http://localhost:8788/mcp
# 2. Test the OAuth flow
# 3. Try the available tools
```

### 8. Claude Desktop Integration

#### Development Configuration
Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "project-master": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8788/mcp"],
      "env": {}
    }
  }
}
```

#### Production Configuration (after deployment)
```json
{
  "mcpServers": {
    "project-master": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker.workers.dev/mcp"],
      "env": {}
    }
  }
}
```

## Production Deployment

### 1. Prepare Cloudflare Workers

```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

### 2. Set Production Secrets

```bash
# Set all required secrets
wrangler secret put GITHUB_CLIENT_ID --config wrangler-project-master.jsonc
wrangler secret put GITHUB_CLIENT_SECRET --config wrangler-project-master.jsonc
wrangler secret put DATABASE_URL --config wrangler-project-master.jsonc
wrangler secret put COOKIE_ENCRYPTION_KEY --config wrangler-project-master.jsonc

# Optional secrets
wrangler secret put ANTHROPIC_API_KEY --config wrangler-project-master.jsonc
wrangler secret put SENTRY_DSN --config wrangler-project-master.jsonc
```

### 3. Update GitHub OAuth App

Update your GitHub OAuth app settings:
- **Homepage URL**: `https://your-worker.workers.dev`
- **Authorization callback URL**: `https://your-worker.workers.dev/callback`

### 4. Deploy to Cloudflare

```bash
# Deploy the Project Master MCP
wrangler deploy --config wrangler-project-master.jsonc

# Deploy the original database MCP (optional)
wrangler deploy
```

### 5. Test Production Deployment

```bash
# Test the deployed endpoints
curl https://your-worker.workers.dev/mcp

# Test OAuth flow in browser
open https://your-worker.workers.dev/authorize
```

## Usage Examples

### Basic Workflow

1. **Initialize a Project**
   ```
   project-init --name="My Web App" --description="A modern web application"
   ```

2. **Parse PRP and Generate Tasks**
   ```
   parse-prp --projectId="uuid" --prpContent="Build a user authentication system..."
   ```

3. **List Generated Tasks**
   ```
   task-list --projectId="uuid"
   ```

4. **Get Next Recommended Task**
   ```
   task-next --projectId="uuid"
   ```

5. **Update Task Status**
   ```
   task-update --taskId="uuid" --status="in_progress"
   ```

6. **Complete a Task**
   ```
   task-complete --taskId="uuid" --actualHours=3 --notes="Implemented with JWT tokens"
   ```

### Advanced Features

- **Filter Tasks**: `task-list --projectId="uuid" --status="todo" --priority="high"`
- **Project Analytics**: `project-get --projectId="uuid"`
- **Context Management**: `project-context --projectId="uuid" --context='{"tech_stack": ["React", "Node.js"]}'`

## Development

### Project Structure

```
/
├── src/
│   ├── project-master.ts        # Main Project Master MCP server
│   ├── project-types.ts         # TypeScript interfaces and Zod schemas
│   ├── project-utils.ts         # Utility functions for project management
│   ├── index.ts                 # Original database MCP server
│   ├── github-handler.ts        # GitHub OAuth implementation
│   ├── database.ts              # PostgreSQL utilities and security
│   └── utils.ts                 # OAuth helper functions
├── migrations/
│   └── 001_project_schema.sql   # Database schema for projects/tasks
├── wrangler-project-master.jsonc # Cloudflare config for Project Master
├── wrangler.jsonc               # Cloudflare config for original MCP
└── README.md                    # Original README
└── README_PROJECT_MASTER.md     # This file
```

### Available Scripts

```bash
# TypeScript compilation check
npm run type-check

# Development server (original MCP)
npm run dev
# or
wrangler dev

# Development server (Project Master MCP)
wrangler dev --config wrangler-project-master.jsonc

# Deploy to production
wrangler deploy --config wrangler-project-master.jsonc

# Generate Cloudflare Worker types
wrangler types
```

### Adding New Tools

1. Define Zod schema in `src/project-types.ts`
2. Add tool implementation in `src/project-master.ts`
3. Update utility functions in `src/project-utils.ts` if needed
4. Test with MCP Inspector

## Troubleshooting

### Common Issues

#### "Wrangler requires Node.js v20.0.0"
```bash
# Update Node.js using nvm
nvm install 20
nvm use 20

# Or using Volta
volta install node@20
```

#### "Database connection failed"
- Verify your `DATABASE_URL` is correct
- Check that your database is accessible from your development environment
- Ensure the database migration has been run

#### "OAuth authorization failed"
- Verify your GitHub OAuth app configuration
- Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set correctly
- Ensure callback URL matches your OAuth app settings

#### "TypeScript compilation errors"
```bash
# Run type check to see specific errors
npm run type-check

# Generate latest Cloudflare Worker types
wrangler types
```

### Debugging

#### Enable Verbose Logging
```bash
# Development
wrangler dev --config wrangler-project-master.jsonc --log-level debug

# Check browser console for OAuth flow issues
# Check terminal for database and server errors
```

#### Database Debugging
```bash
# Connect to database directly
psql $DATABASE_URL

# Check tables exist
\dt

# Check recent projects
SELECT * FROM projects ORDER BY created_at DESC LIMIT 5;

# Check recent tasks
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;
```

## Security Considerations

- **Never commit secrets**: Use `.dev.vars` for local development and Wrangler secrets for production
- **Database access**: All queries include user isolation (`user_id = ${this.props.login}`)
- **Input validation**: All tool inputs are validated using Zod schemas
- **SQL injection protection**: Uses parameterized queries exclusively
- **OAuth security**: Implements secure cookie-based approval system

## Database Schema

The Project Master MCP uses the following database tables:

### Projects Table
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- GitHub username
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    status project_status DEFAULT 'planning',
    prp_content TEXT,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    dependencies UUID[] DEFAULT '{}',
    assignee VARCHAR(255),
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
```

### Enums
- **project_status**: planning, active, paused, completed, archived
- **task_status**: todo, in_progress, blocked, in_review, done
- **task_priority**: critical, high, medium, low

## AI Integration

### Anthropic Claude Integration

The Project Master MCP integrates with Anthropic's Claude API for intelligent PRP parsing:

1. **Set up your API key**:
   ```bash
   # Add to .dev.vars
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

2. **PRP Parsing Features**:
   - Automatically extracts actionable tasks from PRP content
   - Assigns appropriate priority levels
   - Estimates task duration (optional)
   - Identifies task dependencies (optional)

3. **Fallback Behavior**:
   - If API key is missing or API fails, uses simple text parsing
   - Ensures the system continues to work without AI services

### Example PRP Parsing

```
Input PRP:
"Build a user authentication system with login, registration, and password reset. 
The system must use JWT tokens and should integrate with email verification."

Generated Tasks:
1. "Implement user registration endpoint" (High priority, 4 hours)
2. "Create JWT token generation and validation" (High priority, 3 hours)
3. "Build login/logout functionality" (Medium priority, 2 hours)
4. "Add email verification system" (Medium priority, 5 hours)
5. "Implement password reset flow" (Low priority, 3 hours)
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and test thoroughly
4. Run type checking: `npm run type-check`
5. Test with MCP Inspector
6. Submit a pull request

## Comparison with Original Database MCP

| Feature | Original Database MCP | Project Master MCP |
|---------|----------------------|-------------------|
| **Purpose** | Direct database access | Project & task management |
| **Tools** | 3 tools (listTables, queryDatabase, executeDatabase) | 11 specialized tools |
| **Database** | Any PostgreSQL schema | Specific project/task schema |
| **AI Integration** | None | Anthropic Claude for PRP parsing |
| **User Data** | Shared database access | Isolated user projects |
| **Workflow** | Ad-hoc database queries | Structured project lifecycle |

Both servers can run simultaneously using different configurations:
- Original: `wrangler dev` (port 8788)
- Project Master: `wrangler dev --config wrangler-project-master.jsonc` (port 8788, different endpoints)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the [MCP documentation](https://modelcontextprotocol.io/docs)
3. Check [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
4. Open an issue in this repository

---

**Made with ❤️ for AI-assisted development workflows**