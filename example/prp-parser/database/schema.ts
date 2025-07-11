/**
 * Database schema TypeScript types matching the PostgreSQL schema
 * These types correspond to the tables defined in migrations.sql
 */

export interface DbPRP {
  id: string; // UUID
  name: string;
  description: string;
  goal: string;
  why: string[]; // JSON array
  what: string;
  success_criteria: string[]; // JSON array
  context: {
    documentation: DocumentationRef[];
    codebaseTree: string;
    desiredTree: string;
    knownGotchas: string;
  };
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbTask {
  id: string; // UUID
  prp_id: string; // UUID
  task_order: number;
  description: string;
  file_to_modify?: string | null;
  pattern?: string | null;
  pseudocode?: string | null;
  status: "pending" | "in_progress" | "completed";
  additional_info: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface DbTag {
  id: string; // UUID
  name: string;
  description?: string | null;
  color?: string | null; // Hex color
  created_by: string;
  created_at: Date;
}

export interface DbTaskTag {
  task_id: string; // UUID
  tag_id: string; // UUID
  created_at: Date;
}

export interface DbPRPTag {
  prp_id: string; // UUID
  tag_id: string; // UUID
  created_at: Date;
}

export interface DbPRPDocumentation {
  id: string; // UUID
  prp_id: string; // UUID
  doc_type: "url" | "file" | "docfile";
  path: string;
  why?: string | null;
  section?: string | null;
  critical_level?: string | null;
  created_at: Date;
}

export interface DbAuditLog {
  id: string; // UUID
  entity_type: string;
  entity_id: string; // UUID
  action: "create" | "update" | "delete";
  changed_by: string;
  changes: Record<string, any>;
  created_at: Date;
}

// Helper types for queries
export interface DocumentationRef {
  type: "url" | "file" | "docfile";
  path: string;
  why: string;
  section?: string;
  critical?: string;
}

export interface TaskWithTags extends DbTask {
  tags: DbTag[];
}

export interface PRPWithRelations extends DbPRP {
  tasks: DbTask[];
  tags: DbTag[];
  documentation: DbPRPDocumentation[];
}

// Query filter types
export interface TaskFilter {
  prp_id?: string;
  status?: DbTask["status"];
  tags?: string[];
  search?: string;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface PRPFilter {
  created_by?: string;
  tags?: string[];
  search?: string;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

// Result types
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}