/**
 * PRP structure validation utilities
 * Ensures PRPs follow expected format and contain required sections
 */

import { ParsedPRP, ValidationError } from "../types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class PRPValidator {
  /**
   * Validate a PRP markdown string before parsing
   */
  static validatePRPContent(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum length
    if (content.length < 100) {
      errors.push("PRP content is too short (minimum 100 characters)");
    }

    // Check maximum length
    if (content.length > 50000) {
      errors.push("PRP content exceeds maximum length (50000 characters)");
    }

    // Check for frontmatter
    if (!content.startsWith("---")) {
      errors.push("PRP must start with YAML frontmatter (---)");
    } else {
      // Validate frontmatter structure
      const frontmatterEnd = content.indexOf("---", 3);
      if (frontmatterEnd === -1) {
        errors.push("YAML frontmatter is not properly closed");
      } else {
        const frontmatter = content.substring(3, frontmatterEnd);
        if (!frontmatter.includes("name:")) {
          errors.push("Frontmatter must include 'name' field");
        }
        if (!frontmatter.includes("description:")) {
          warnings.push("Frontmatter should include 'description' field");
        }
      }
    }

    // Check for required sections
    const requiredSections = ["## Purpose", "## Goal", "## Why", "## What"];
    const contentLower = content.toLowerCase();

    for (const section of requiredSections) {
      if (!contentLower.includes(section.toLowerCase())) {
        errors.push(`Missing required section: ${section}`);
      }
    }

    // Check for recommended sections
    const recommendedSections = ["## Success Criteria", "## All Needed Context"];
    for (const section of recommendedSections) {
      if (!contentLower.includes(section.toLowerCase())) {
        warnings.push(`Missing recommended section: ${section}`);
      }
    }

    // Check for task list
    if (
      !contentLower.includes("task") ||
      (!contentLower.includes("list of tasks") && !contentLower.includes("implementation tasks"))
    ) {
      warnings.push("PRP should include a task list section");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate parsed PRP structure
   */
  static validateParsedPRP(prp: ParsedPRP): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!prp.name || prp.name.trim().length === 0) {
      errors.push("PRP name is required");
    }

    if (!prp.description || prp.description.trim().length === 0) {
      errors.push("PRP description is required");
    }

    if (!prp.goal || prp.goal.trim().length === 0) {
      errors.push("PRP goal is required");
    }

    if (!prp.why || prp.why.length === 0) {
      errors.push("PRP must include at least one 'why' reason");
    }

    if (!prp.what || prp.what.trim().length === 0) {
      errors.push("PRP 'what' section is required");
    }

    // Validate arrays
    if (!Array.isArray(prp.why)) {
      errors.push("'why' must be an array of reasons");
    }

    if (!Array.isArray(prp.successCriteria)) {
      errors.push("'successCriteria' must be an array");
    } else if (prp.successCriteria.length === 0) {
      warnings.push("PRP should include success criteria");
    }

    if (!Array.isArray(prp.tasks)) {
      errors.push("'tasks' must be an array");
    } else if (prp.tasks.length === 0) {
      warnings.push("PRP should include at least one task");
    }

    // Validate context
    if (!prp.context) {
      errors.push("PRP context is required");
    } else {
      if (!Array.isArray(prp.context.documentation)) {
        errors.push("Context documentation must be an array");
      }

      // Validate documentation references
      prp.context.documentation.forEach((doc, index) => {
        if (!doc.type || !["url", "file", "docfile"].includes(doc.type)) {
          errors.push(`Documentation ${index + 1}: Invalid type '${doc.type}'`);
        }
        if (!doc.path || doc.path.trim().length === 0) {
          errors.push(`Documentation ${index + 1}: Path is required`);
        }
        if (!doc.why || doc.why.trim().length === 0) {
          warnings.push(`Documentation ${index + 1}: Should include 'why' explanation`);
        }
      });
    }

    // Validate tasks
    const taskOrders = new Set<number>();
    prp.tasks.forEach((task, index) => {
      if (!task.description || task.description.trim().length === 0) {
        errors.push(`Task ${index + 1}: Description is required`);
      }

      if (typeof task.order !== "number" || task.order <= 0) {
        errors.push(`Task ${index + 1}: Order must be a positive number`);
      } else if (taskOrders.has(task.order)) {
        errors.push(`Task ${index + 1}: Duplicate order number ${task.order}`);
      } else {
        taskOrders.add(task.order);
      }

      // Validate optional fields
      if (task.fileToModify && !this.isValidFilePath(task.fileToModify)) {
        warnings.push(`Task ${index + 1}: File path '${task.fileToModify}' may be invalid`);
      }
    });

    // Check task order sequence
    const sortedOrders = Array.from(taskOrders).sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i + 1) {
        warnings.push(`Task orders should be sequential starting from 1`);
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
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

  /**
   * Sanitize PRP content for safe storage
   */
  static sanitizePRPContent(content: string): string {
    // Remove any potential script tags or dangerous content
    let sanitized = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

    // Remove inline event handlers
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");

    // Limit consecutive newlines
    sanitized = sanitized.replace(/\n{4,}/g, "\n\n\n");

    return sanitized.trim();
  }

  /**
   * Check if PRP content looks like a valid markdown document
   */
  static looksLikePRP(content: string): boolean {
    // Quick heuristics to check if content resembles a PRP
    const indicators = [
      content.includes("---") && content.indexOf("---", 3) > 3, // Has frontmatter
      /##?\s+(Purpose|Goal|Why|What)/i.test(content), // Has expected headers
      /name:\s*['""]?[^'""]+['""]?/i.test(content), // Has name in frontmatter
      content.length > 500, // Reasonable length
    ];

    return indicators.filter(Boolean).length >= 3;
  }
}