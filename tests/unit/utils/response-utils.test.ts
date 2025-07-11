/**
 * Unit tests for response utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  createErrorResponse,
  createSuccessResponse,
  createInfoResponse,
  createListResponse,
  createDetailResponse,
  createNotFoundResponse,
  createPermissionDeniedResponse
} from '@/project-master/utils/response-utils';

describe('Response Utils', () => {
  describe('createErrorResponse', () => {
    it('should create basic error response', () => {
      const response = createErrorResponse('Something went wrong');
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('**Error**');
      expect(response.content[0].text).toContain('Something went wrong');
      expect(response.content[0].isError).toBe(true);
    });

    it('should include details when provided', () => {
      const details = { errorCode: 'DB_001', retryAfter: 30 };
      const response = createErrorResponse('Database error', details);
      
      expect(response.content[0].text).toContain('Database error');
      expect(response.content[0].text).toContain('**Details:**');
      expect(response.content[0].text).toContain('DB_001');
      expect(response.content[0].text).toContain('30');
    });

    it('should handle null/undefined details', () => {
      const response1 = createErrorResponse('Error', null);
      const response2 = createErrorResponse('Error', undefined);
      
      expect(response1.content[0].text).not.toContain('**Details:**');
      expect(response2.content[0].text).not.toContain('**Details:**');
    });
  });

  describe('createSuccessResponse', () => {
    it('should create basic success response', () => {
      const response = createSuccessResponse('Operation completed');
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('**Success**');
      expect(response.content[0].text).toContain('Operation completed');
      expect(response.content[0].isError).toBeUndefined();
    });

    it('should include data when provided', () => {
      const data = { taskId: 'task123', createdAt: '2024-01-01' };
      const response = createSuccessResponse('Task created', data);
      
      expect(response.content[0].text).toContain('Task created');
      expect(response.content[0].text).toContain('**Data:**');
      expect(response.content[0].text).toContain('task123');
      expect(response.content[0].text).toContain('2024-01-01');
    });

    it('should handle complex nested data', () => {
      const complexData = {
        project: { id: 'proj1', name: 'Test Project' },
        stats: { completed: 5, total: 10 },
        metadata: { version: '1.0', lastModified: '2024-01-01' }
      };
      
      const response = createSuccessResponse('Data retrieved', complexData);
      
      expect(response.content[0].text).toContain('Test Project');
      expect(response.content[0].text).toContain('"completed": 5');
    });
  });

  describe('createInfoResponse', () => {
    it('should create basic info response', () => {
      const response = createInfoResponse('Status Update', 'All systems operational');
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('**Status Update**');
      expect(response.content[0].text).toContain('All systems operational');
    });

    it('should include additional info when provided', () => {
      const additionalInfo = { uptime: '99.9%', lastCheck: '2024-01-01' };
      const response = createInfoResponse('System Status', 'Running smoothly', additionalInfo);
      
      expect(response.content[0].text).toContain('Running smoothly');
      expect(response.content[0].text).toContain('**Data:**');
      expect(response.content[0].text).toContain('99.9%');
    });
  });

  describe('createListResponse', () => {
    const mockItems = [
      { id: 1, name: 'Item One', status: 'active' },
      { id: 2, name: 'Item Two', status: 'inactive' },
      { id: 3, name: 'Item Three', status: 'pending' }
    ];

    const simpleFormatter = (item: any, index: number) => 
      `${index + 1}. ${item.name} (${item.status})`;

    it('should create list response with formatted items', () => {
      const response = createListResponse('My Items', mockItems, simpleFormatter);
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].text).toContain('**My Items**');
      expect(response.content[0].text).toContain('1. Item One (active)');
      expect(response.content[0].text).toContain('2. Item Two (inactive)');
      expect(response.content[0].text).toContain('3. Item Three (pending)');
    });

    it('should include pagination info when provided', () => {
      const paginationInfo = { total: 100, limit: 10, offset: 0, hasMore: true };
      const response = createListResponse('My Items', mockItems, simpleFormatter, paginationInfo);
      
      expect(response.content[0].text).toContain('**Pagination:**');
      expect(response.content[0].text).toContain('Showing 3 of 100 items');
      expect(response.content[0].text).toContain('Has more: Yes');
    });

    it('should handle empty list', () => {
      const response = createListResponse('Empty List', [], simpleFormatter);
      
      expect(response.content[0].text).toContain('**Empty List**');
      expect(response.content[0].text).toContain('(0)');
    });

    it('should handle pagination without more items', () => {
      const paginationInfo = { total: 3, limit: 10, offset: 0, hasMore: false };
      const response = createListResponse('Complete List', mockItems, simpleFormatter, paginationInfo);
      
      expect(response.content[0].text).toContain('Showing 3 of 3 items');
      expect(response.content[0].text).not.toContain('Has more: Yes');
    });
  });

  describe('createDetailResponse', () => {
    const mockItem = { id: 'task123', title: 'Test Task', status: 'in_progress' };
    const detailFormatter = (item: any) => 
      `**${item.title}**\nID: ${item.id}\nStatus: ${item.status}`;

    it('should create detail response with formatted item', () => {
      const response = createDetailResponse('Task Details', mockItem, detailFormatter);
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].text).toContain('**Test Task**');
      expect(response.content[0].text).toContain('**Test Task**');
      expect(response.content[0].text).toContain('ID: task123');
      expect(response.content[0].text).toContain('Status: in_progress');
    });

    it('should include action suggestions when provided', () => {
      const actions = [
        'task-update --taskId="task123"',
        'task-complete --taskId="task123"',
        'task-delete --taskId="task123"'
      ];
      
      const response = createDetailResponse('Task Details', mockItem, detailFormatter, actions);
      
      expect(response.content[0].text).toContain('**Available Actions:**');
      expect(response.content[0].text).toContain('task-update --taskId="task123"');
      expect(response.content[0].text).toContain('task-complete --taskId="task123"');
      expect(response.content[0].text).toContain('task-delete --taskId="task123"');
    });

    it('should handle empty actions array', () => {
      const response = createDetailResponse('Task Details', mockItem, detailFormatter, []);
      
      expect(response.content[0].text).not.toContain('**Available Actions:**');
    });
  });

  describe('createNotFoundResponse', () => {
    it('should create not found response for different resource types', () => {
      const taskResponse = createNotFoundResponse('Task', 'task123');
      const projectResponse = createNotFoundResponse('Project', 'proj456');
      
      expect(taskResponse.content[0].text).toContain('**Not Found**');
      expect(taskResponse.content[0].text).toContain('Task with ID "task123" was not found');
      expect(taskResponse.content[0].isError).toBe(true);
      
      expect(projectResponse.content[0].text).toContain('Project with ID "proj456" was not found');
    });

    it('should include helpful suggestions', () => {
      const response = createNotFoundResponse('Task', 'task123');
      
      expect(response.content[0].text).toContain('Task with ID');
      expect(response.content[0].text).toContain('was not found');
    });
  });

  describe('createPermissionDeniedResponse', () => {
    it('should create permission denied response for different resource types', () => {
      const taskResponse = createPermissionDeniedResponse('task');
      const projectResponse = createPermissionDeniedResponse('project');
      
      expect(taskResponse.content[0].text).toContain('**Permission Denied**');
      expect(taskResponse.content[0].text).toContain('access task');
      expect(taskResponse.content[0].isError).toBe(true);
      
      expect(projectResponse.content[0].text).toContain('access project');
    });

    it('should include helpful information about permissions', () => {
      const response = createPermissionDeniedResponse('task');
      
      expect(response.content[0].text).toContain('Permission Denied');
      expect(response.content[0].text).toContain('access task');
    });

    it('should handle unknown resource types gracefully', () => {
      const response = createPermissionDeniedResponse('unknown_resource' as any);
      
      expect(response.content[0].text).toContain('access unknown_resource');
    });
  });

  describe('Response format consistency', () => {
    it('should all responses follow MCP content format', () => {
      const responses = [
        createErrorResponse('Test error'),
        createSuccessResponse('Test success'),
        createInfoResponse('Test', 'Info'),
        createListResponse('Test', [], () => ''),
        createDetailResponse('Test', {}, () => ''),
        createNotFoundResponse('Test', 'id'),
        createPermissionDeniedResponse('test')
      ];

      responses.forEach(response => {
        expect(response).toHaveProperty('content');
        expect(Array.isArray(response.content)).toBe(true);
        expect(response.content).toHaveLength(1);
        expect(response.content[0]).toHaveProperty('type', 'text');
        expect(response.content[0]).toHaveProperty('text');
        expect(typeof response.content[0].text).toBe('string');
      });
    });

    it('should properly mark error responses', () => {
      const errorResponses = [
        createErrorResponse('Test'),
        createNotFoundResponse('Test', 'id'),
        createPermissionDeniedResponse('test')
      ];

      errorResponses.forEach(response => {
        expect(response.content[0].isError).toBe(true);
      });
    });

    it('should not mark non-error responses as errors', () => {
      const nonErrorResponses = [
        createSuccessResponse('Test'),
        createInfoResponse('Test', 'Info'),
        createListResponse('Test', [], () => ''),
        createDetailResponse('Test', {}, () => '')
      ];

      nonErrorResponses.forEach(response => {
        expect(response.content[0].isError).toBeUndefined();
      });
    });
  });
});