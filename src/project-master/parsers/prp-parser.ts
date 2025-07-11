/**
 * PRP parsing utilities using Anthropic Claude API
 * Handles intelligent parsing of Product Requirements Prompts for AI coding assistants
 */

import {
  AITask,
  TaskGenerationConfig,
  TaskPriority,
  DEFAULT_ANTHROPIC_MODEL,
} from "../types";

export class PRPParser {
  constructor(
    private apiKey: string,
    private model: string = DEFAULT_ANTHROPIC_MODEL
  ) {}

  /**
   * Generate implementation tasks from PRP content using AI
   */
  async generateTasksFromPRP(
    prpContent: string,
    projectContext: any,
    config: TaskGenerationConfig
  ): Promise<AITask[]> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: this.buildPRPParsingPrompt(prpContent, projectContext, config)
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const content = (result as any).content[0].text;
      
      // Parse the JSON response
      const aiTasks = JSON.parse(content);
      
      // Validate and normalize the response
      return this.validateAndNormalizeTasks(aiTasks, config);
      
    } catch (error) {
      console.error('AI task generation failed:', error);
      
      // Fallback to simple parsing
      return this.parsePreviewPRP(prpContent, projectContext, config);
    }
  }

  /**
   * Build the prompt for PRP parsing optimized for AI coding assistants
   */
  private buildPRPParsingPrompt(
    prpContent: string,
    projectContext: any,
    config: TaskGenerationConfig
  ): string {
    return `Parse the following Product Requirements Prompt (PRP) and generate up to ${config.maxTasks} concrete implementation tasks for an AI coding assistant.

PRP Content:
${prpContent}

Project Context:
${JSON.stringify(projectContext, null, 2)}

Requirements:
- Generate specific, implementation-focused tasks with code patterns and file paths
- Each task should include validation gates (tests, type checking, linting)
- Focus on concrete implementation steps rather than abstract requirements
- Include specific file paths, library imports, and code examples where relevant
- Assign appropriate priority levels (critical, high, medium, low)
- ${config.estimateHours ? 'Include estimated hours for each task' : 'Do not include time estimates'}
- ${config.generateDependencies ? 'Identify task dependencies where logical' : 'Do not include dependencies'}
- ${config.includeMilestones ? 'Include milestone tasks with validation gates' : 'Focus on implementation tasks only'}

Return the response as a JSON array with this exact format:
[
  {
    "title": "Implementation task title",
    "description": "Detailed implementation steps with file paths, code patterns, and validation requirements",
    "priority": "high|medium|low|critical",
    ${config.estimateHours ? '"estimatedHours": 3,' : ''}
    ${config.generateDependencies ? '"dependencies": ["task-index-1", "task-index-2"],' : ''}
    "validationGates": ["tests", "type-check", "lint"],
    "implementationHints": ["specific code patterns", "file paths", "library imports"]
  }
]

Important: Return only the JSON array, no additional text or formatting.`;
  }

  /**
   * Validate and normalize AI-generated tasks
   */
  private validateAndNormalizeTasks(aiTasks: any[], config: TaskGenerationConfig): AITask[] {
    return aiTasks.slice(0, config.maxTasks).map((task: any, index: number) => {
      const validatedTask: AITask = {
        title: task.title?.substring(0, 100) || `Generated Implementation Task ${index + 1}`,
        description: task.description || task.title || `Implementation task ${index + 1}`,
        priority: Object.values(TaskPriority).includes(task.priority) ? 
          task.priority : config.defaultPriority,
      };

      if (config.estimateHours && task.estimatedHours && typeof task.estimatedHours === 'number') {
        validatedTask.estimatedHours = Math.max(0.5, Math.min(40, task.estimatedHours));
      }

      if (config.generateDependencies && task.dependencies && Array.isArray(task.dependencies)) {
        validatedTask.dependencies = task.dependencies.filter((dep: any) => 
          typeof dep === 'string' && dep.match(/^task-index-\d+$/)
        );
      }

      return validatedTask;
    });
  }

  /**
   * Fallback parsing when AI is unavailable
   */
  private parsePreviewPRP(
    prpContent: string, 
    projectContext: any, 
    config: TaskGenerationConfig
  ): AITask[] {
    const tasks: AITask[] = [];
    
    // Simple parsing logic for fallback - focused on implementation keywords
    const lines = prpContent.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Look for implementation-focused actionable items
      if (line.includes('implement') || line.includes('create') || line.includes('build') || 
          line.includes('code') || line.includes('function') || line.includes('class') ||
          line.includes('component') || line.includes('api') || line.includes('test')) {
        
        const title = line.substring(0, 100).trim();
        const priority = line.includes('critical') || line.includes('must') ? 
          TaskPriority.HIGH : TaskPriority.MEDIUM;
        
        tasks.push({
          title,
          description: `${line.trim()}\n\nValidation gates: Run tests and type checking after implementation.`,
          priority,
          estimatedHours: config.estimateHours ? Math.floor(Math.random() * 8) + 1 : undefined
        });
        
        if (tasks.length >= config.maxTasks) break;
      }
    }
    
    return tasks;
  }

  /**
   * Validate PRP content format for AI coding assistant prompts
   */
  static validatePRPContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!content || content.trim().length === 0) {
      errors.push('PRP content cannot be empty');
    }
    
    if (content.length < 50) {
      errors.push('PRP content is too short to be meaningful');
    }
    
    if (content.length > 50000) {
      errors.push('PRP content exceeds maximum length of 50,000 characters');
    }
    
    // Check for implementation-focused structure indicators
    const hasImplementationContext = content.toLowerCase().includes('implement') || 
                                   content.toLowerCase().includes('create') ||
                                   content.toLowerCase().includes('build') ||
                                   content.toLowerCase().includes('code') ||
                                   content.toLowerCase().includes('function') ||
                                   content.toLowerCase().includes('class') ||
                                   content.toLowerCase().includes('component') ||
                                   content.toLowerCase().includes('api') ||
                                   content.toLowerCase().includes('test') ||
                                   content.toLowerCase().includes('validate');
    
    if (!hasImplementationContext) {
      errors.push('PRP content should contain implementation instructions, code patterns, or technical specifications');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize PRP content for processing
   */
  static sanitizePRPContent(content: string): string {
    return content
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/['"]/g, '"') // Normalize quotes
      .trim();
  }
}