-- PRP Parser MCP Server Database Schema
-- This file contains all database migrations for the PRP parser system

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PRPs table: Stores parsed Product Requirement Prompts
CREATE TABLE IF NOT EXISTS prps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    goal TEXT NOT NULL,
    why JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of reasons
    what TEXT NOT NULL,
    success_criteria JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of criteria
    context JSONB NOT NULL DEFAULT '{}'::jsonb, -- Contains documentation, trees, gotchas
    created_by VARCHAR(255) NOT NULL, -- GitHub username
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table: Stores tasks extracted from PRPs
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prp_id UUID NOT NULL REFERENCES prps(id) ON DELETE CASCADE,
    task_order INTEGER NOT NULL,
    description TEXT NOT NULL,
    file_to_modify VARCHAR(500),
    pattern TEXT,
    pseudocode TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    additional_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL -- Soft delete support
);

-- Tags table: Stores tags for organization
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task-Tag junction table
CREATE TABLE IF NOT EXISTS task_tags (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, tag_id)
);

-- PRP-Tag junction table
CREATE TABLE IF NOT EXISTS prp_tags (
    prp_id UUID NOT NULL REFERENCES prps(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (prp_id, tag_id)
);

-- Documentation table: Stores PRP documentation separately for better querying
CREATE TABLE IF NOT EXISTS prp_documentation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prp_id UUID NOT NULL REFERENCES prps(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('url', 'file', 'docfile')),
    path TEXT NOT NULL,
    why TEXT,
    section TEXT,
    critical_level VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table: Tracks all changes for compliance
CREATE TABLE IF NOT EXISTS prp_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- 'prp', 'task', 'tag', etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
    changed_by VARCHAR(255) NOT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_prps_created_by ON prps(created_by);
CREATE INDEX idx_prps_created_at ON prps(created_at DESC);
CREATE INDEX idx_tasks_prp_id ON tasks(prp_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_audit_entity ON prp_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON prp_audit_log(created_at DESC);

-- Full-text search indexes
CREATE INDEX idx_prps_search ON prps USING gin(
    to_tsvector('english', name || ' ' || description || ' ' || goal || ' ' || what)
);
CREATE INDEX idx_tasks_search ON tasks USING gin(
    to_tsvector('english', description || ' ' || COALESCE(pattern, '') || ' ' || COALESCE(pseudocode, ''))
);

-- Update trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prps_updated_at BEFORE UPDATE ON prps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Enable for production
-- ALTER TABLE prps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prp_documentation ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment and customize for production)
-- CREATE POLICY prps_read_all ON prps FOR SELECT USING (true);
-- CREATE POLICY prps_write_own ON prps FOR ALL USING (created_by = current_user);
-- CREATE POLICY tasks_read_all ON tasks FOR SELECT USING (true);
-- CREATE POLICY tasks_write_privileged ON tasks FOR ALL USING (
--     EXISTS (SELECT 1 FROM prps WHERE prps.id = tasks.prp_id AND prps.created_by = current_user)
-- );

-- Grant permissions (adjust for your database user)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;