/**
 * Database schema TypeScript types for Project Master MCP
 * These types correspond to the tables defined in migrations/001_project_schema.sql
 */

// Database row interfaces (snake_case matching PostgreSQL)
export interface DbProject {
  id: string; // UUID
  user_id: string; // GitHub username
  name: string;
  description?: string | null;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  prp_content?: string | null;
  context: Record<string, any>; // JSONB
  created_at: Date;
  updated_at: Date;
}

export interface DbTask {
  id: string; // UUID
  project_id: string; // UUID
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done';
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies?: string[] | null; // UUID array
  assignee?: string | null; // GitHub username
  estimated_hours?: string | number | null; // DECIMAL(5,2) - PostgreSQL returns as string
  actual_hours?: string | number | null; // DECIMAL(5,2) - PostgreSQL returns as string
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date | null;
}

export interface DbProjectMember {
  project_id: string; // UUID
  user_id: string; // GitHub username
  role: string; // owner, admin, member, viewer
  added_at: Date;
}

// Application domain interfaces (camelCase for TypeScript)
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  prpContent?: string;
  context?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies?: string[];
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  addedAt: Date;
}

// Enums
export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  IN_REVIEW = 'in_review',
  DONE = 'done'
}

export enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum ProjectRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

// Extended types with relations
export interface ProjectWithStats extends Project {
  taskCount: number;
  completedTasks: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  completionRate: number;
}

export interface TaskWithDependencies extends Task {
  dependentTasks: string[]; // Tasks that depend on this task
  canStart: boolean; // Whether all dependencies are completed
  project?: Project;
}

export interface ProjectWithTasks extends Project {
  tasks: Task[];
}

// Query filter types
export interface ProjectFilter {
  userId?: string;
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
}

export interface TaskFilter {
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// Result types
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ProjectAnalytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  completionRate: number;
  averageTaskDuration: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  efficiencyRatio: number;
}

// Task generation types
export interface AITask {
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedHours?: number;
  dependencies?: string[];
}

export interface TaskGenerationConfig {
  maxTasks: number;
  includeMilestones: boolean;
  defaultPriority: TaskPriority;
  estimateHours: boolean;
  generateDependencies: boolean;
}

// Helper function to convert database row to domain object
export function dbProjectToProject(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    userId: dbProject.user_id,
    name: dbProject.name,
    description: dbProject.description || undefined,
    status: dbProject.status as ProjectStatus,
    prpContent: dbProject.prp_content || undefined,
    context: dbProject.context,
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
  };
}

export function dbTaskToTask(dbTask: DbTask): Task {
  // Convert string/number DECIMAL fields to numbers
  const convertToNumber = (value: string | number | null | undefined): number | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return typeof value === 'number' ? value : undefined;
  };

  return {
    id: dbTask.id,
    projectId: dbTask.project_id,
    title: dbTask.title,
    description: dbTask.description || undefined,
    status: dbTask.status as TaskStatus,
    priority: dbTask.priority as TaskPriority,
    dependencies: dbTask.dependencies || undefined,
    assignee: dbTask.assignee || undefined,
    estimatedHours: convertToNumber(dbTask.estimated_hours),
    actualHours: convertToNumber(dbTask.actual_hours),
    notes: dbTask.notes || undefined,
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at,
    completedAt: dbTask.completed_at || undefined,
  };
}

export function dbProjectMemberToProjectMember(dbMember: DbProjectMember): ProjectMember {
  return {
    projectId: dbMember.project_id,
    userId: dbMember.user_id,
    role: dbMember.role as ProjectRole,
    addedAt: dbMember.added_at,
  };
}