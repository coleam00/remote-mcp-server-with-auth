/**
 * Unit tests for task management tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockMcpServer, createMockEnv, createMockProps, createMockPrivilegedProps } from '@tests/mocks/mcp';
import { createMockWithDatabase, seedMockDatabase, resetMockDatabase } from '@tests/mocks/database';
import { registerTaskTools } from '@/project-master/tools/task-tools';

// Mock the database module
vi.mock('@/database', () => ({
  withDatabase: createMockWithDatabase()
}));

// Mock task utilities
vi.mock('@/project-master/utils/task-utils', () => ({
  findNextTask: vi.fn().mockReturnValue({
    id: 'task_test_1',
    title: 'Setup Database Schema',
    description: 'Create the initial database schema for the project',
    status: 'todo',
    priority: 'high',
    estimated_hours: 4,
    dependencies: []
  }),
  checkProjectPermission: vi.fn().mockReturnValue({ hasPermission: true }),
  formatDuration: vi.fn().mockImplementation((hours) => `${hours}h`),
  formatPriority: vi.fn().mockImplementation((priority) => priority.toUpperCase()),
  formatStatus: vi.fn().mockImplementation((status) => status.replace('_', ' ').toUpperCase())
}));

// Import actual response utilities instead of mocking them
import {
  createErrorResponse,
  createSuccessResponse,
  createListResponse,
  createDetailResponse,
  createPermissionDeniedResponse,
  createNotFoundResponse
} from '@/project-master/utils/response-utils';

describe('Task Tools', () => {
  let mockServer: any;
  let mockEnv: any;
  let mockProps: any;
  let mockPrivilegedProps: any;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    mockEnv = createMockEnv();
    mockProps = createMockProps();
    mockPrivilegedProps = createMockPrivilegedProps();
    resetMockDatabase();
    seedMockDatabase();
    vi.clearAllMocks();
  });

  describe('task-list', () => {
    beforeEach(() => {
      resetMockDatabase();
      seedMockDatabase();
      registerTaskTools(mockServer, mockEnv, mockProps);
    });

    it('should list tasks for a project', async () => {
      const args = {
        projectId: 'proj_test_123',
        limit: 10,
        offset: 0
      };

      const result = await mockServer.callTool('task-list', args);

      expect(result.content[0].text).toContain('Tasks for');
      expect(result.content[0].text).toContain('Setup Database Schema');
    });

    it('should filter tasks by status', async () => {
      const args = {
        projectId: 'proj_test_123',
        status: 'todo',
        limit: 10,
        offset: 0
      };

      const result = await mockServer.callTool('task-list', args);

      expect(result.content[0].text).toContain('Tasks for');
    });

    it('should filter tasks by priority', async () => {
      const args = {
        projectId: 'proj_test_123',
        priority: 'high',
        limit: 10,
        offset: 0
      };

      const result = await mockServer.callTool('task-list', args);

      expect(result.content[0].text).toContain('Tasks for');
    });

    it('should handle project not found', async () => {
      const args = {
        projectId: 'nonexistent_project',
        limit: 10,
        offset: 0
      };

      const result = await mockServer.callTool('task-list', args);

      expect(result.content[0].text).toContain('Project not found or access denied');
      expect(result.content[0].isError).toBe(true);
    });

    it('should handle no tasks found', async () => {
      // Reset and add a project without tasks
      resetMockDatabase();
      const mockData = (global as any).mockData;
      mockData.projects.push({
        id: 'proj_empty',
        user_id: 'testuser',
        name: 'Empty Project',
        description: 'A project with no tasks',
        status: 'planning',
        context: {},
        prp_content: null,
        created_at: new Date(),
        updated_at: new Date()
      });

      const args = {
        projectId: 'proj_empty',
        limit: 10,
        offset: 0
      };

      const result = await mockServer.callTool('task-list', args);

      expect(result.content[0].text).toContain('No tasks found');
      expect(result.content[0].isError).toBe(true);
    });
  });

  describe('task-next', () => {
    beforeEach(() => {
      resetMockDatabase();
      seedMockDatabase();
      registerTaskTools(mockServer, mockEnv, mockProps);
    });

    it('should identify next recommended task', async () => {
      const args = {
        projectId: 'proj_test_123',
        excludeBlocked: false
      };

      const result = await mockServer.callTool('task-next', args);

      expect(result.content[0].text).toContain('Setup Database Schema');
      expect(result.content[0].text).toContain('task-update');
      expect(result.content[0].text).toContain('task-complete');
    });

    it('should handle no available tasks', async () => {
      // Mock findNextTask to return null
      const { findNextTask } = await import('@/project-master/utils/task-utils');
      vi.mocked(findNextTask).mockReturnValueOnce(null);

      const args = {
        projectId: 'proj_test_123',
        excludeBlocked: false
      };

      const result = await mockServer.callTool('task-next', args);

      expect(result.content[0].text).toContain('No available tasks');
      expect(result.content[0].isError).toBe(true);
    });

    it('should exclude blocked tasks when requested', async () => {
      const args = {
        projectId: 'proj_test_123',
        excludeBlocked: true
      };

      const result = await mockServer.callTool('task-next', args);

      expect(result.content[0].text).toContain('Setup Database Schema');
    });
  });

  describe('task-get', () => {
    beforeEach(() => {
      resetMockDatabase();
      seedMockDatabase();
      registerTaskTools(mockServer, mockEnv, mockProps);
    });

    it('should get task details with project info', async () => {
      const args = { taskId: 'task_test_1' };

      const result = await mockServer.callTool('task-get', args);

      expect(result.content[0].text).toContain('Setup Database Schema');
      expect(result.content[0].text).toContain('Test Project');
      expect(result.content[0].text).toContain('task_test_1');
    });

    it('should handle task not found', async () => {
      const args = { taskId: 'nonexistent_task' };

      const result = await mockServer.callTool('task-get', args);

      expect(result.content[0].text).toContain('Not Found');
      expect(result.content[0].isError).toBe(true);
    });

    it('should handle permission denied', async () => {
      // Mock permission check to fail
      const { checkProjectPermission } = await import('@/project-master/utils/task-utils');
      vi.mocked(checkProjectPermission).mockReturnValueOnce({ hasPermission: false });

      const args = { taskId: 'task_test_1' };

      const result = await mockServer.callTool('task-get', args);

      expect(result.content[0].text).toContain('Permission Denied');
      expect(result.content[0].isError).toBe(true);
    });
  });

  describe('task-update (privileged only)', () => {
    it('should register task-update tool for privileged users', () => {
      registerTaskTools(mockServer, mockEnv, mockPrivilegedProps);

      const tools = mockServer.getRegisteredTools();
      expect(tools.has('task-update')).toBe(true);
    });

    it('should not register task-update tool for regular users', () => {
      registerTaskTools(mockServer, mockEnv, mockProps);

      const tools = mockServer.getRegisteredTools();
      expect(tools.has('task-update')).toBe(false);
    });

    it('should update task properties', async () => {
      resetMockDatabase();
      // Seed data with privileged user
      const mockData = (global as any).mockData;
      mockData.projects.push({
        id: 'proj_priv_123',
        user_id: 'coleam00', // Use privileged user
        name: 'Privileged Project',
        description: 'A test project for privileged user',
        status: 'planning',
        context: {},
        prp_content: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      mockData.tasks.push({
        id: 'task_priv_1',
        project_id: 'proj_priv_123',
        title: 'Privileged Task',
        description: 'A task for testing privileged operations',
        status: 'todo',
        priority: 'high',
        estimated_hours: 4,
        actual_hours: null,
        assignee: null,
        dependencies: [],
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null
      });
      
      registerTaskTools(mockServer, mockEnv, mockPrivilegedProps);

      const args = {
        taskId: 'task_priv_1',
        title: 'Updated Task Title',
        status: 'in_progress',
        priority: 'critical'
      };

      const result = await mockServer.callTool('task-update', args);

      expect(result.content[0].text).toContain('Task updated successfully');
    });

    it('should handle no updates provided', async () => {
      resetMockDatabase();
      // Seed data with privileged user
      const mockData = (global as any).mockData;
      mockData.projects.push({
        id: 'proj_priv_123',
        user_id: 'coleam00',
        name: 'Privileged Project',
        description: 'A test project for privileged user',
        status: 'planning',
        context: {},
        prp_content: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      mockData.tasks.push({
        id: 'task_priv_1',
        project_id: 'proj_priv_123',
        title: 'Privileged Task',
        description: 'A task for testing privileged operations',
        status: 'todo',
        priority: 'high',
        estimated_hours: 4,
        actual_hours: null,
        assignee: null,
        dependencies: [],
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null
      });
      
      registerTaskTools(mockServer, mockEnv, mockPrivilegedProps);

      const args = { taskId: 'task_priv_1' };

      const result = await mockServer.callTool('task-update', args);

      expect(result.content[0].text).toContain('No updates provided');
      expect(result.content[0].isError).toBe(true);
    });
  });

  describe('task-complete (privileged only)', () => {
    it('should register task-complete tool for privileged users', () => {
      registerTaskTools(mockServer, mockEnv, mockPrivilegedProps);

      const tools = mockServer.getRegisteredTools();
      expect(tools.has('task-complete')).toBe(true);
    });

    it('should not register task-complete tool for regular users', () => {
      registerTaskTools(mockServer, mockEnv, mockProps);

      const tools = mockServer.getRegisteredTools();
      expect(tools.has('task-complete')).toBe(false);
    });

    it('should complete a task successfully', async () => {
      resetMockDatabase();
      // Seed data with privileged user
      const mockData = (global as any).mockData;
      mockData.projects.push({
        id: 'proj_priv_123',
        user_id: 'coleam00',
        name: 'Privileged Project',
        description: 'A test project for privileged user',
        status: 'planning',
        context: {},
        prp_content: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      mockData.tasks.push({
        id: 'task_priv_1',
        project_id: 'proj_priv_123',
        title: 'Privileged Task',
        description: 'A task for testing privileged operations',
        status: 'todo',
        priority: 'high',
        estimated_hours: 4,
        actual_hours: null,
        assignee: null,
        dependencies: [],
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null
      });
      
      registerTaskTools(mockServer, mockEnv, mockPrivilegedProps);

      const args = {
        taskId: 'task_priv_1',
        actualHours: 5,
        notes: 'Completed successfully with extra time for testing'
      };

      const result = await mockServer.callTool('task-complete', args);

      expect(result.content[0].text).toContain('Task completed successfully! 🎉');
      expect(result.content[0].text).toContain('efficiency');
    });

    it('should handle already completed task', async () => {
      resetMockDatabase();
      // Seed data with privileged user and completed task
      const mockData = (global as any).mockData;
      mockData.projects.push({
        id: 'proj_priv_123',
        user_id: 'coleam00',
        name: 'Privileged Project',
        description: 'A test project for privileged user',
        status: 'planning',
        context: {},
        prp_content: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      mockData.tasks.push({
        id: 'task_priv_1',
        project_id: 'proj_priv_123',
        title: 'Privileged Task',
        description: 'A task for testing privileged operations',
        status: 'done', // Already completed
        priority: 'high',
        estimated_hours: 4,
        actual_hours: 3,
        assignee: null,
        dependencies: [],
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: new Date()
      });
      
      registerTaskTools(mockServer, mockEnv, mockPrivilegedProps);

      const args = {
        taskId: 'task_priv_1',
        actualHours: 5
      };

      const result = await mockServer.callTool('task-complete', args);

      expect(result.content[0].text).toContain('Task is already completed');
      expect(result.content[0].isError).toBe(true);
    });
  });

  describe('Permission-based tool registration', () => {
    it('should register read-only tools for regular users', () => {
      registerTaskTools(mockServer, mockEnv, mockProps);

      const tools = mockServer.getRegisteredTools();
      
      expect(tools.has('task-list')).toBe(true);
      expect(tools.has('task-next')).toBe(true);
      expect(tools.has('task-get')).toBe(true);
      expect(tools.has('task-update')).toBe(false);
      expect(tools.has('task-complete')).toBe(false);
    });

    it('should register all tools for privileged users', () => {
      registerTaskTools(mockServer, mockEnv, mockPrivilegedProps);

      const tools = mockServer.getRegisteredTools();
      
      expect(tools.has('task-list')).toBe(true);
      expect(tools.has('task-next')).toBe(true);
      expect(tools.has('task-get')).toBe(true);
      expect(tools.has('task-update')).toBe(true);
      expect(tools.has('task-complete')).toBe(true);
    });
  });
});