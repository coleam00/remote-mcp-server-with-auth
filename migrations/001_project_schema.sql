-- Project Master MCP Database Schema
-- PostgreSQL migration for projects and tasks tables

-- Create enum types for status values
CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'completed', 'archived');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'in_review', 'done');
CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low');

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- GitHub username from OAuth
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    status project_status NOT NULL DEFAULT 'planning',
    prp_content TEXT, -- Product Requirements Prompt content for AI coding assistants
    context JSONB DEFAULT '{}', -- Additional project context for AI assistance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_per_user UNIQUE (user_id, name)
);

-- Update column comment to reflect PRP purpose
COMMENT ON COLUMN projects.prp_content IS 'Product Requirements Prompt content for AI coding assistants';

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    dependencies UUID[] DEFAULT '{}', -- Array of task IDs this task depends on
    assignee VARCHAR(255), -- GitHub username if assigned
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_hours CHECK (estimated_hours >= 0 AND actual_hours >= 0)
);

-- Project members table for future team features
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- GitHub username
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to validate task dependencies (prevent circular dependencies)
CREATE OR REPLACE FUNCTION validate_task_dependencies()
RETURNS TRIGGER AS $$
DECLARE
    dep_id UUID;
    visited UUID[] := ARRAY[NEW.id];
    to_check UUID[] := NEW.dependencies;
    current_deps UUID[];
BEGIN
    -- Check if any dependencies exist in the same project
    IF array_length(NEW.dependencies, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM unnest(NEW.dependencies) AS dep_id
            WHERE NOT EXISTS (
                SELECT 1 FROM tasks 
                WHERE id = dep_id AND project_id = NEW.project_id
            )
        ) THEN
            RAISE EXCEPTION 'All task dependencies must be in the same project';
        END IF;
    END IF;
    
    -- Check for circular dependencies
    WHILE array_length(to_check, 1) > 0 LOOP
        dep_id := to_check[1];
        to_check := to_check[2:];
        
        IF dep_id = ANY(visited) THEN
            RAISE EXCEPTION 'Circular dependency detected';
        END IF;
        
        visited := array_append(visited, dep_id);
        
        SELECT dependencies INTO current_deps
        FROM tasks
        WHERE id = dep_id;
        
        IF current_deps IS NOT NULL AND array_length(current_deps, 1) > 0 THEN
            to_check := array_cat(to_check, current_deps);
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate task dependencies
CREATE TRIGGER validate_task_dependencies_trigger
    BEFORE INSERT OR UPDATE OF dependencies ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_task_dependencies();

-- Sample data for testing (commented out by default)
/*
-- Insert sample project
INSERT INTO projects (user_id, name, description, status, prp_content)
VALUES (
    'test-user',
    'Sample Project',
    'A sample project for testing the Project Master MCP',
    'active',
    'This is a sample PRP content for testing purposes.'
);

-- Insert sample tasks (use the project ID from above)
INSERT INTO tasks (project_id, title, description, status, priority)
SELECT 
    id,
    'Setup development environment',
    'Install all necessary tools and dependencies',
    'todo',
    'high'
FROM projects
WHERE user_id = 'test-user' AND name = 'Sample Project';
*/