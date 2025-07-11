/**
 * Task management utility functions
 * Includes task dependency validation, prioritization, and analytics
 */

import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskDependencyGraph,
  ProjectAnalytics,
  ValidationResult,
  PermissionResult,
  Props
} from "../types";

/**
 * Validates task dependencies to prevent circular references
 */
export function validateTaskDependencies(
  taskId: string, 
  dependencies: string[], 
  allTasks: Task[]
): ValidationResult {
  const errors: string[] = [];
  
  if (!dependencies || dependencies.length === 0) {
    return { isValid: true, errors: [] };
  }

  // Check if task is trying to depend on itself
  if (dependencies.includes(taskId)) {
    errors.push("Task cannot depend on itself");
  }

  // Build dependency graph to check for cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(currentTaskId: string): boolean {
    if (recursionStack.has(currentTaskId)) {
      return true; // Cycle detected
    }
    
    if (visited.has(currentTaskId)) {
      return false; // Already processed
    }

    visited.add(currentTaskId);
    recursionStack.add(currentTaskId);

    // Get dependencies for current task
    const currentTask = allTasks.find(t => t.id === currentTaskId);
    const currentDeps = currentTaskId === taskId ? dependencies : currentTask?.dependencies || [];

    for (const depId of currentDeps) {
      if (hasCycle(depId)) {
        return true;
      }
    }

    recursionStack.delete(currentTaskId);
    return false;
  }

  // Check for circular dependencies
  if (hasCycle(taskId)) {
    errors.push("Circular dependency detected");
  }

  // Check if all dependencies exist in the same project
  const taskProjectId = allTasks.find(t => t.id === taskId)?.projectId;
  if (taskProjectId) {
    for (const depId of dependencies) {
      const depTask = allTasks.find(t => t.id === depId);
      if (!depTask) {
        errors.push(`Dependency task ${depId} not found`);
      } else if (depTask.projectId !== taskProjectId) {
        errors.push(`Dependency task ${depId} is not in the same project`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Builds a dependency graph for visualization and analysis
 */
export function buildTaskDependencyGraph(tasks: Task[]): TaskDependencyGraph {
  const graph: TaskDependencyGraph = {};
  
  // Initialize graph nodes
  for (const task of tasks) {
    graph[task.id] = {
      task,
      dependencies: task.dependencies || [],
      dependents: [],
      level: 0
    };
  }

  // Build dependent relationships
  for (const task of tasks) {
    if (task.dependencies) {
      for (const depId of task.dependencies) {
        if (graph[depId]) {
          graph[depId].dependents.push(task.id);
        }
      }
    }
  }

  // Calculate dependency levels (topological sort)
  const calculateLevel = (taskId: string, visited: Set<string>): number => {
    if (visited.has(taskId)) return 0; // Avoid infinite recursion
    
    visited.add(taskId);
    const node = graph[taskId];
    
    if (!node || node.dependencies.length === 0) {
      return 0;
    }

    let maxLevel = 0;
    for (const depId of node.dependencies) {
      if (graph[depId]) {
        const depLevel = calculateLevel(depId, new Set(visited));
        maxLevel = Math.max(maxLevel, depLevel + 1);
      }
    }

    return maxLevel;
  };

  // Calculate levels for all tasks
  for (const taskId of Object.keys(graph)) {
    graph[taskId].level = calculateLevel(taskId, new Set());
  }

  return graph;
}

/**
 * Finds the next recommended task based on dependencies and priority
 */
export function findNextTask(
  tasks: Task[], 
  excludeBlocked: boolean = false
): Task | null {
  // Filter available tasks
  const availableTasks = tasks.filter(task => {
    if (task.status === TaskStatus.DONE) return false;
    if (excludeBlocked && task.status === TaskStatus.BLOCKED) return false;
    if (task.status === TaskStatus.IN_PROGRESS) return false;

    // Check if all dependencies are completed
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (!depTask || depTask.status !== TaskStatus.DONE) {
          return false; // Dependencies not met
        }
      }
    }

    return true;
  });

  if (availableTasks.length === 0) return null;

  // Sort by priority and creation date
  const priorityOrder = {
    [TaskPriority.CRITICAL]: 0,
    [TaskPriority.HIGH]: 1,
    [TaskPriority.MEDIUM]: 2,
    [TaskPriority.LOW]: 3
  };

  availableTasks.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // If same priority, prefer older tasks
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return availableTasks[0];
}

/**
 * Calculates project analytics and statistics
 */
export function calculateProjectAnalytics(tasks: Task[]): ProjectAnalytics {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE).length;
  const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
  const blockedTasks = tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
  
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Helper function to safely convert to number
  const safeToNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }
    return typeof value === 'number' ? value : 0;
  };
  
  const totalEstimatedHours = tasks.reduce((sum, task) => {
    return sum + safeToNumber(task.estimatedHours);
  }, 0);
  
  const totalActualHours = tasks.reduce((sum, task) => {
    return sum + safeToNumber(task.actualHours);
  }, 0);

  const completedTasksWithHours = tasks.filter(t => 
    t.status === TaskStatus.DONE && t.actualHours && t.completedAt
  );
  
  const averageTaskDuration = completedTasksWithHours.length > 0 ? 
    completedTasksWithHours.reduce((sum, task) => sum + safeToNumber(task.actualHours), 0) / completedTasksWithHours.length : 0;

  const efficiencyRatio = totalEstimatedHours > 0 && totalActualHours > 0 ? 
    (totalEstimatedHours / totalActualHours) * 100 : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    completionRate,
    averageTaskDuration,
    totalEstimatedHours,
    totalActualHours,
    efficiencyRatio
  };
}

/**
 * Checks if user has permission to access a project
 */
export function checkProjectPermission(
  projectUserId: string,
  currentUser: Props,
  requiredPermission: 'read' | 'write' | 'admin' = 'read'
): PermissionResult {
  // Simple ownership check - in a real implementation, 
  // you'd check project_members table for shared projects
  if (projectUserId === currentUser.login) {
    return { hasPermission: true };
  }

  return { 
    hasPermission: false, 
    reason: "You don't have permission to access this project" 
  };
}

/**
 * Formats task duration for display
 */
export function formatDuration(hours: number | string | null | undefined): string {
  // Convert to number and handle edge cases
  const numHours = typeof hours === 'string' ? parseFloat(hours) : (hours || 0);
  
  // Handle invalid numbers
  if (isNaN(numHours) || numHours <= 0) {
    return 'No time';
  }
  
  if (numHours < 1) {
    return `${Math.round(numHours * 60)} minutes`;
  } else if (numHours < 24) {
    return `${numHours.toFixed(1)} hours`;
  } else {
    const days = Math.floor(numHours / 24);
    const remainingHours = numHours % 24;
    return `${days} day${days > 1 ? 's' : ''}${remainingHours > 0 ? ` ${remainingHours.toFixed(1)} hours` : ''}`;
  }
}

/**
 * Formats task priority for display
 */
export function formatPriority(priority: TaskPriority): string {
  const symbols = {
    [TaskPriority.CRITICAL]: '🔴',
    [TaskPriority.HIGH]: '🟠',
    [TaskPriority.MEDIUM]: '🟡',
    [TaskPriority.LOW]: '🟢'
  };
  
  return `${symbols[priority]} ${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
}

/**
 * Formats task status for display
 */
export function formatStatus(status: TaskStatus): string {
  const symbols = {
    [TaskStatus.TODO]: '⏳',
    [TaskStatus.IN_PROGRESS]: '🔄',
    [TaskStatus.BLOCKED]: '🚫',
    [TaskStatus.IN_REVIEW]: '👀',
    [TaskStatus.DONE]: '✅'
  };
  
  return `${symbols[status]} ${status.replace('_', ' ').toUpperCase()}`;
}

/**
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim();
}

/**
 * Generates a project summary from tasks and context
 */
export function generateProjectSummary(
  projectName: string,
  tasks: Task[],
  analytics: ProjectAnalytics
): string {
  return `**${projectName}** - ${analytics.totalTasks} tasks, ${analytics.completedTasks} completed (${analytics.completionRate.toFixed(1)}%)

**Progress:**
- ✅ Completed: ${analytics.completedTasks}
- 🔄 In Progress: ${analytics.inProgressTasks}  
- 🚫 Blocked: ${analytics.blockedTasks}
- ⏳ Todo: ${analytics.totalTasks - analytics.completedTasks - analytics.inProgressTasks - analytics.blockedTasks}

**Time Tracking:**
- Estimated: ${formatDuration(analytics.totalEstimatedHours)}
- Actual: ${formatDuration(analytics.totalActualHours)}
- Efficiency: ${analytics.efficiencyRatio.toFixed(1)}%`;
}