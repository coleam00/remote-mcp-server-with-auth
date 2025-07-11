/**
 * Global test setup for Project Master MCP Server
 * Sets up mocks and global test utilities
 */

import { vi } from 'vitest';

// Global test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.GITHUB_CLIENT_ID = 'test_client_id';
process.env.GITHUB_CLIENT_SECRET = 'test_client_secret';
process.env.COOKIE_ENCRYPTION_KEY = 'test_encryption_key';
process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';
process.env.ANTHROPIC_MODEL = 'claude-3-haiku-20240307';

// Global fetch mock for API calls
global.fetch = vi.fn();

// Console mocks to reduce noise during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Global test utilities
declare global {
  var testUtils: {
    createMockUser: () => any;
    createMockProject: () => any;
    createMockTask: () => any;
    resetAllMocks: () => void;
  };
}

global.testUtils = {
  createMockUser: () => ({
    login: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    accessToken: 'test_token'
  }),

  createMockProject: () => ({
    id: 'proj_test_123',
    user_id: 'testuser',
    name: 'Test Project',
    description: 'A test project',
    status: 'planning',
    context: {},
    prp_content: 'Test PRP content',
    created_at: new Date(),
    updated_at: new Date()
  }),

  createMockTask: () => ({
    id: 'task_test_123',
    project_id: 'proj_test_123',
    title: 'Test Task',
    description: 'A test task',
    status: 'todo',
    priority: 'medium',
    estimated_hours: 4,
    actual_hours: null,
    assignee: null,
    dependencies: [],
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    completed_at: null
  }),

  resetAllMocks: () => {
    vi.clearAllMocks();
  }
};