/**
 * Task extraction utilities for PRP parsing
 * Provides focused task extraction and processing functionality
 */

import { Task, ParsedPRP } from "../types";

export interface ExtractedTask {
  order: number;
  description: string;
  fileToModify?: string;
  pattern?: string;
  pseudocode?: string;
  context?: string; // Additional context from the PRP
}

export class TaskExtractor {
  /**
   * Process extracted tasks and enrich with additional context
   */
  static processTasks(tasks: ParsedPRP["tasks"], prpContext?: string): ExtractedTask[] {
    return tasks.map((task, index) => {
      const processed: ExtractedTask = {
        order: task.order || index + 1,
        description: this.cleanDescription(task.description),
      };

      // Extract file to modify if present
      if (task.fileToModify) {
        processed.fileToModify = this.normalizeFilePath(task.fileToModify);
      }

      // Clean up pattern if present
      if (task.pattern) {
        processed.pattern = this.cleanPattern(task.pattern);
      }

      // Clean up pseudocode if present
      if (task.pseudocode) {
        processed.pseudocode = this.cleanPseudocode(task.pseudocode);
      }

      // Add context if available
      if (prpContext) {
        processed.context = prpContext;
      }

      return processed;
    });
  }

  /**
   * Clean and normalize task description
   */
  private static cleanDescription(description: string): string {
    return description
      .trim()
      .replace(/^[-*•]\s*/, "") // Remove bullet points
      .replace(/^\d+\.\s*/, "") // Remove numbering
      .replace(/\s+/g, " "); // Normalize whitespace
  }

  /**
   * Normalize file paths
   */
  private static normalizeFilePath(path: string): string {
    // Remove leading ./ or /
    let normalized = path.trim().replace(/^\.\//, "").replace(/^\//, "");

    // Ensure consistent forward slashes
    normalized = normalized.replace(/\\/g, "/");

    return normalized;
  }

  /**
   * Clean pattern text
   */
  private static cleanPattern(pattern: string): string {
    return pattern
      .trim()
      .replace(/```[a-z]*\n?/g, "") // Remove code block markers
      .replace(/\n{3,}/g, "\n\n"); // Normalize multiple newlines
  }

  /**
   * Clean pseudocode text
   */
  private static cleanPseudocode(pseudocode: string): string {
    return pseudocode
      .trim()
      .replace(/```[a-z]*\n?/g, "") // Remove code block markers
      .replace(/\n{3,}/g, "\n\n"); // Normalize multiple newlines
  }

  /**
   * Extract task dependencies from description
   */
  static extractDependencies(task: ExtractedTask): number[] {
    const dependencies: number[] = [];

    // Look for patterns like "after task 3", "depends on task 5", etc.
    const depPatterns = [
      /after task (\d+)/gi,
      /depends on task (\d+)/gi,
      /requires task (\d+)/gi,
      /following task (\d+)/gi,
    ];

    for (const pattern of depPatterns) {
      const matches = task.description.matchAll(pattern);
      for (const match of matches) {
        const taskNum = parseInt(match[1]);
        if (!isNaN(taskNum) && !dependencies.includes(taskNum)) {
          dependencies.push(taskNum);
        }
      }
    }

    return dependencies.sort((a, b) => a - b);
  }

  /**
   * Group tasks by file they modify
   */
  static groupByFile(tasks: ExtractedTask[]): Map<string, ExtractedTask[]> {
    const groups = new Map<string, ExtractedTask[]>();

    for (const task of tasks) {
      const file = task.fileToModify || "_no_file";
      if (!groups.has(file)) {
        groups.set(file, []);
      }
      groups.get(file)!.push(task);
    }

    return groups;
  }

  /**
   * Estimate task complexity based on description and details
   */
  static estimateComplexity(task: ExtractedTask): "low" | "medium" | "high" {
    let score = 0;

    // Check description length
    if (task.description.length > 200) score += 2;
    else if (task.description.length > 100) score += 1;

    // Check for multiple files mentioned
    const fileMatches = task.description.match(/\b[\w\/]+\.(ts|js|tsx|jsx|json|md)\b/g);
    if (fileMatches && fileMatches.length > 1) score += 2;

    // Check for complex keywords
    const complexKeywords = [
      "refactor",
      "redesign",
      "migrate",
      "optimize",
      "implement",
      "integrate",
      "architecture",
    ];
    const descLower = task.description.toLowerCase();
    for (const keyword of complexKeywords) {
      if (descLower.includes(keyword)) score += 1;
    }

    // Check if pseudocode is present
    if (task.pseudocode) score += 1;

    // Check if pattern is complex
    if (task.pattern && task.pattern.length > 100) score += 1;

    // Determine complexity
    if (score >= 4) return "high";
    if (score >= 2) return "medium";
    return "low";
  }

  /**
   * Validate task structure
   */
  static validateTask(task: ExtractedTask): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!task.description || task.description.trim().length === 0) {
      errors.push("Task description is required");
    }

    if (task.order <= 0) {
      errors.push("Task order must be positive");
    }

    if (task.fileToModify && !this.isValidFilePath(task.fileToModify)) {
      errors.push(`Invalid file path: ${task.fileToModify}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a file path is valid
   */
  private static isValidFilePath(path: string): boolean {
    // Basic validation - no .. traversal, no absolute paths
    if (path.includes("..") || path.startsWith("/") || path.includes("://")) {
      return false;
    }

    // Check for valid characters
    const validPathRegex = /^[a-zA-Z0-9\-_./]+$/;
    return validPathRegex.test(path);
  }
}