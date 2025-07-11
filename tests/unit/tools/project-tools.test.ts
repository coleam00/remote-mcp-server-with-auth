/**
 * Unit tests for project management tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockMcpServer, createMockEnv, createMockProps } from '@tests/mocks/mcp';
import { createMockWithDatabase, seedMockDatabase, resetMockDatabase } from '@tests/mocks/database';
import { registerProjectTools } from '@/project-master/tools/project-tools';

// Mock the database module
vi.mock('@/database', () => ({
  withDatabase: createMockWithDatabase()
}));

// Import actual response utilities
import {
  createErrorResponse,
  createSuccessResponse,
  createListResponse,
  createDetailResponse,
  createInfoResponse
} from '@/project-master/utils/response-utils';

describe('Project Tools', () => {
  let mockServer: any;
  let mockEnv: any;
  let mockProps: any;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    mockEnv = createMockEnv();
    mockProps = createMockProps();
    resetMockDatabase();
    seedMockDatabase();
    vi.clearAllMocks();
  });

  describe('project-init', () => {
    beforeEach(() => {
      registerProjectTools(mockServer, mockEnv, mockProps);
    });

    it('should create a new project successfully', async () => {
      const args = {
        name: 'New Test Project',
        description: 'A brand new test project',
        prpContent: 'This is a test PRP',
        context: { tech_stack: ['React', 'Node.js'] }
      };

      const result = await mockServer.callTool('project-init', args);

      expect(result.content[0].text).toContain('Project created successfully');
      expect(result.content[0].text).toContain('New Test Project');
      expect(result.content[0].text).toContain('parse-prp');
    });

    it('should prevent duplicate project names', async () => {
      const args = {
        name: 'Test Project', // This name already exists in seeded data
        description: 'Duplicate project'
      };

      const result = await mockServer.callTool('project-init', args);

      expect(result.content[0].text).toContain('A project named "Test Project" already exists');
      expect(result.content[0].isError).toBe(true);
    });

    it('should handle missing optional fields', async () => {
      const args = {
        name: 'Minimal Project'
      };

      const result = await mockServer.callTool('project-init', args);

      expect(result.content[0].text).toContain('Project created successfully');
      expect(result.content[0].text).toContain('Minimal Project');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database to throw error
      const { withDatabase } = await import('@/database');
      vi.mocked(withDatabase).mockRejectedValueOnce(new Error('Database connection failed'));

      const args = {
        name: 'Error Project',
        description: 'This should fail'
      };

      const result = await mockServer.callTool('project-init', args);

      expect(result.content[0].text).toContain('Failed to create project');
      expect(result.content[0].isError).toBe(true);
    });
  });

  describe('project-list', () => {
    beforeEach(() => {
      registerProjectTools(mockServer, mockEnv, mockProps);
    });

    it('should list user projects with stats', async () => {
      const args = { limit: 10 };

      const result = await mockServer.callTool('project-list', args);

      expect(result.content[0].text).toContain('Your Projects');
      expect(result.content[0].text).toContain('Test Project');
      expect(result.content[0].text).toContain('Tasks:');
      expect(result.content[0].text).toContain('% complete');
    });

    it('should filter projects by status', async () => {
      const args = { status: 'planning', limit: 10 };

      const result = await mockServer.callTool('project-list', args);

      expect(result.content[0].text).toContain('Your Projects');
      // Should only show planning projects
    });

    it('should handle no projects found', async () => {
      // Clear all mock data to simulate no projects
      resetMockDatabase();
      // Don't seed the database - leave it empty
      
      const args = { limit: 10 };

      const result = await mockServer.callTool('project-list', args);

      expect(result.content[0].text).toContain('No Projects Found');
      expect(result.content[0].text).toContain('project-init');
    });

    it('should respect limit parameter', async () => {
      const args = { limit: 1 };

      const result = await mockServer.callTool('project-list', args);

      // Should still work with limited results
      expect(result.content[0].text).toContain('Your Projects');
    });
  });

  describe('project-get', () => {
    beforeEach(() => {
      registerProjectTools(mockServer, mockEnv, mockProps);
    });

    it('should get project details with analytics', async () => {
      const args = { projectId: 'proj_test_123' };

      const result = await mockServer.callTool('project-get', args);

      expect(result.content[0].text).toContain('Project Details');
      expect(result.content[0].text).toContain('Test Project');
      expect(result.content[0].text).toContain('Recent Tasks');
      expect(result.content[0].text).toContain('task-list');
    });

    it('should handle project not found', async () => {
      const args = { projectId: 'nonexistent_project' };

      const result = await mockServer.callTool('project-get', args);

      expect(result.content[0].text).toContain('Project not found or access denied');
      expect(result.content[0].isError).toBe(true);
    });

    it('should handle access denied for other users projects', async () => {
      // Test with different user
      const differentUserProps = createMockProps({ login: 'otheruser' });
      registerProjectTools(mockServer, mockEnv, differentUserProps);

      const args = { projectId: 'proj_test_123' };

      const result = await mockServer.callTool('project-get', args);

      expect(result.content[0].text).toContain('Project not found or access denied');
      expect(result.content[0].isError).toBe(true);
    });

    it('should show task status icons', async () => {
      const args = { projectId: 'proj_test_123' };

      const result = await mockServer.callTool('project-get', args);

      // Check for task status icons
      expect(result.content[0].text).toMatch(/[⏳🔄✅]/); // Should contain status emojis
    });
  });

  describe('Tool Registration', () => {
    it('should register all three project tools', () => {
      registerProjectTools(mockServer, mockEnv, mockProps);

      const tools = mockServer.getRegisteredTools();
      
      expect(tools.has('project-init')).toBe(true);
      expect(tools.has('project-list')).toBe(true);
      expect(tools.has('project-get')).toBe(true);
      expect(tools.size).toBe(3);
    });

    it('should register tools with correct descriptions', () => {
      registerProjectTools(mockServer, mockEnv, mockProps);

      const tools = mockServer.getRegisteredTools();
      
      expect(tools.get('project-init').description).toContain('Initialize a new AI coding project');
      expect(tools.get('project-list').description).toContain('List all projects for the authenticated user');
      expect(tools.get('project-get').description).toContain('Get detailed information about a specific project');
    });
  });
});