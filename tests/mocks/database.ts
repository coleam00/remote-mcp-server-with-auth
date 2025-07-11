/**
 * Database mocking utilities for testing
 * Provides mock implementations for postgres database calls
 */

import { vi } from 'vitest';

// Mock data storage
let mockData: {
  projects: any[];
  tasks: any[];
  project_members: any[];
} = {
  projects: [],
  tasks: [],
  project_members: []
};

// Expose mockData globally for test manipulation
(global as any).mockData = mockData;

// Reset mock data
export function resetMockDatabase() {
  mockData.projects = [];
  mockData.tasks = [];
  mockData.project_members = [];
  (global as any).mockData = mockData;
}

// Seed mock data
export function seedMockDatabase() {
  resetMockDatabase();
  
  // Add sample project
  mockData.projects.push({
    id: 'proj_test_123',
    user_id: 'testuser',
    name: 'Test Project',
    description: 'A test project for unit testing',
    status: 'planning',
    context: { tech_stack: ['TypeScript', 'PostgreSQL'] },
    prp_content: 'Test PRP content for parsing',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  });

  // Add sample tasks
  mockData.tasks.push(
    {
      id: 'task_test_1',
      project_id: 'proj_test_123',
      title: 'Setup Database Schema',
      description: 'Create the initial database schema for the project',
      status: 'todo',
      priority: 'high',
      estimated_hours: 4,
      actual_hours: null,
      assignee: null,
      dependencies: [],
      notes: null,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      completed_at: null
    },
    {
      id: 'task_test_2',
      project_id: 'proj_test_123',
      title: 'Implement API Endpoints',
      description: 'Create REST API endpoints for project management',
      status: 'in_progress',
      priority: 'medium',
      estimated_hours: 8,
      actual_hours: 5,
      assignee: 'testuser',
      dependencies: ['task_test_1'],
      notes: 'Making good progress',
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-02'),
      completed_at: null
    }
  );
  
  // Update global reference
  (global as any).mockData = mockData;
}

// Mock SQL query function
export function createMockDb() {
  const mockDb = vi.fn();
  
  // Mock template literal SQL queries
  mockDb.mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
    const query = strings.join('?').toLowerCase();
    
    // Project duplicate name check
    if (query.includes('select id from projects') && query.includes('where user_id =') && query.includes('and name =')) {
      const userId = values[0];
      const name = values[1];
      return Promise.resolve(mockData.projects.filter(p => p.user_id === userId && p.name === name));
    }
    
    // Project name check for project list (for "no projects" scenarios)
    if (query.includes('select name from projects') && query.includes('where id =') && query.includes('and user_id =')) {
      const projectId = values[0];
      const userId = values[1];
      const project = mockData.projects.find(p => p.id === projectId && p.user_id === userId);
      return Promise.resolve(project ? [{ name: project.name }] : []);
    }
    
    if (query.includes('select * from projects')) {
      if (query.includes('where id =') && query.includes('and user_id =')) {
        const projectId = values[0];
        const userId = values[1];
        return Promise.resolve(mockData.projects.filter(p => p.id === projectId && p.user_id === userId));
      }
      if (query.includes('where user_id =')) {
        const userId = values[0];
        if (query.includes('and status =')) {
          const status = values[1];
          return Promise.resolve(mockData.projects.filter(p => p.user_id === userId && p.status === status));
        }
        return Promise.resolve(mockData.projects.filter(p => p.user_id === userId));
      }
      return Promise.resolve(mockData.projects);
    }

    // Task queries
    if (query.includes('select * from tasks')) {
      if (query.includes('where project_id =')) {
        const projectId = values[0];
        let filteredTasks = mockData.tasks.filter(t => t.project_id === projectId);
        
        // Apply additional filters
        if (query.includes('and status =')) {
          const status = values[1];
          filteredTasks = filteredTasks.filter(t => t.status === status);
        }
        if (query.includes('and priority =')) {
          const priorityIndex = query.includes('and status =') ? 2 : 1;
          const priority = values[priorityIndex];
          filteredTasks = filteredTasks.filter(t => t.priority === priority);
        }
        
        return Promise.resolve(filteredTasks);
      }
      return Promise.resolve(mockData.tasks);
    }

    // Task with project info queries
    if (query.includes('select t.*, p.name as project_name') || 
        query.includes('select t.*, p.user_id as project_user_id')) {
      const taskId = values[0];
      const task = mockData.tasks.find(t => t.id === taskId);
      if (task) {
        const project = mockData.projects.find(p => p.id === task.project_id);
        return Promise.resolve([{
          ...task,
          project_name: project?.name || 'Unknown Project',
          project_user_id: project?.user_id
        }]);
      }
      return Promise.resolve([]);
    }

    // Count queries
    if (query.includes('select count(*) as count')) {
      if (query.includes('from tasks')) {
        const projectId = values[0];
        const count = mockData.tasks.filter(t => t.project_id === projectId).length;
        return Promise.resolve([{ count: count.toString() }]);
      }
      if (query.includes('from projects')) {
        return Promise.resolve([{ count: mockData.projects.length.toString() }]);
      }
    }

    // Task stats query
    if (query.includes('count(*) as total_tasks')) {
      const projectId = values[0];
      const projectTasks = mockData.tasks.filter(t => t.project_id === projectId);
      const completed = projectTasks.filter(t => t.status === 'done').length;
      const totalHours = projectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      
      return Promise.resolve([{
        total_tasks: projectTasks.length.toString(),
        completed_tasks: completed.toString(),
        total_estimated_hours: totalHours.toString()
      }]);
    }

    // Insert queries
    if (query.includes('insert into projects')) {
      const newProject = {
        id: `proj_${Date.now()}`,
        user_id: values[0],
        name: values[1],
        description: values[2],
        status: values[3],
        prp_content: values[4],
        context: values[5],
        created_at: new Date(),
        updated_at: new Date()
      };
      mockData.projects.push(newProject);
      return Promise.resolve([newProject]);
    }

    if (query.includes('insert into tasks')) {
      const newTask = {
        id: `task_${Date.now()}`,
        project_id: values[0],
        title: values[1],
        description: values[2],
        status: values[3],
        priority: values[4],
        estimated_hours: values[5],
        assignee: null,
        dependencies: [],
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null
      };
      mockData.tasks.push(newTask);
      return Promise.resolve([newTask]);
    }

    // Update queries
    if (query.includes('update projects')) {
      const projectId = values[values.length - 1]; // ID is usually last
      const projectIndex = mockData.projects.findIndex(p => p.id === projectId);
      if (projectIndex >= 0) {
        mockData.projects[projectIndex].updated_at = new Date();
        return Promise.resolve([mockData.projects[projectIndex]]);
      }
      return Promise.resolve([]);
    }

    if (query.includes('update tasks')) {
      const taskId = values[values.length - 1]; // ID is usually last
      const taskIndex = mockData.tasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        mockData.tasks[taskIndex].updated_at = new Date();
        return Promise.resolve([mockData.tasks[taskIndex]]);
      }
      return Promise.resolve([]);
    }

    // Delete queries
    if (query.includes('delete from tasks')) {
      const projectId = values[0];
      mockData.tasks = mockData.tasks.filter(t => t.project_id !== projectId);
      return Promise.resolve([]);
    }

    // Default empty result
    return Promise.resolve([]);
  });

  return mockDb;
}

// Mock withDatabase function
export function createMockWithDatabase() {
  return vi.fn().mockImplementation(async (databaseUrl: string, operation: Function) => {
    const mockDb = createMockDb();
    return await operation(mockDb);
  });
}