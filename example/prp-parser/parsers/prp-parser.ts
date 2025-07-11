/**
 * PRP Parser using Anthropic Claude API
 * Extracts structured information from Product Requirement Prompts
 */

import { z } from "zod";
import { ParsedPRP, PRPParseError, DocumentationRef } from "../types";

// Response schema for validation
const AnthropicResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  goal: z.string(),
  why: z.array(z.string()),
  what: z.string(),
  successCriteria: z.array(z.string()),
  context: z.object({
    documentation: z.array(
      z.object({
        type: z.enum(["url", "file", "docfile"]),
        path: z.string(),
        why: z.string(),
        section: z.string().optional(),
        critical: z.string().optional(),
      }),
    ),
    codebaseTree: z.string(),
    desiredTree: z.string(),
    knownGotchas: z.string(),
  }),
  tasks: z.array(
    z.object({
      order: z.number(),
      description: z.string(),
      fileToModify: z.string().optional(),
      pattern: z.string().optional(),
      pseudocode: z.string().optional(),
    }),
  ),
});

export class PRPParser {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async parsePRP(content: string): Promise<ParsedPRP> {
    const prompt = `You are a PRP (Product Requirement Prompt) parser. Extract structured information from the following PRP markdown content.

Extract:
1. Name and description from the YAML frontmatter
2. Goal section
3. Why section (as array of bullet points)
4. What section
5. Success criteria (as array)
6. All documentation references (urls, files, docfiles) with their reasons
7. Current codebase tree (if present)
8. Desired codebase tree (if present)
9. Known gotchas section
10. Task list with order, descriptions, and any implementation details

Important:
- Extract EXACT text from the PRP, do not summarize or modify
- For tasks, look for sections like "List of Tasks", "Implementation Tasks", or numbered lists
- Tasks may include file paths to modify, patterns to follow, or pseudocode
- Documentation references can appear in various sections, capture all of them
- If a section is missing, use empty string for text fields or empty array for arrays

Return a JSON object with this structure:
{
  "name": "PRP name from frontmatter",
  "description": "PRP description from frontmatter",
  "goal": "Goal section content",
  "why": ["reason 1 from bullet points", "reason 2", ...],
  "what": "What section content",
  "successCriteria": ["criteria 1", "criteria 2", ...],
  "context": {
    "documentation": [
      {
        "type": "url",
        "path": "https://example.com",
        "why": "reason for this doc",
        "section": "optional section",
        "critical": "optional critical info"
      }
    ],
    "codebaseTree": "current tree content or empty string",
    "desiredTree": "desired tree content or empty string",
    "knownGotchas": "gotchas content or empty string"
  },
  "tasks": [
    {
      "order": 1,
      "description": "Task description",
      "fileToModify": "optional/path/to/file.ts",
      "pattern": "optional pattern to follow",
      "pseudocode": "optional pseudocode"
    }
  ]
}

PRP Content:
${content}`;

    try {
      // Make request to Anthropic API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-4-sonnet-20250514",
          max_tokens: 8000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new PRPParseError(`Anthropic API error: ${response.status}`, error);
      }

      const data = await response.json();

      // Extract JSON from the response
      const content = (data as any).content[0].text;
      let parsedData: any;

      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        parsedData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new PRPParseError("Failed to parse JSON from Anthropic response", content);
      }

      // Validate with Zod schema
      const validated = AnthropicResponseSchema.parse(parsedData);

      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PRPParseError("Invalid response structure from Anthropic", error.errors);
      }
      if (error instanceof PRPParseError) {
        throw error;
      }
      throw new PRPParseError("Failed to parse PRP", error);
    }
  }

  /**
   * Extract just the tasks from a PRP without full parsing
   */
  async extractTasks(content: string): Promise<ParsedPRP["tasks"]> {
    const parsed = await this.parsePRP(content);
    return parsed.tasks;
  }

  /**
   * Extract just the documentation references from a PRP
   */
  async extractDocumentation(content: string): Promise<DocumentationRef[]> {
    const parsed = await this.parsePRP(content);
    return parsed.context.documentation;
  }
}