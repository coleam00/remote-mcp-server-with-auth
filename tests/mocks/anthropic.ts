/**
 * Anthropic API mocking utilities for testing
 * Provides mock implementations for Claude API calls
 */

import { vi } from 'vitest';

// Mock Anthropic API responses
export const mockAnthropicResponses = {
  successfulParsing: {
    content: [{
      type: 'text',
      text: JSON.stringify([
        {
          title: 'Setup Project Structure',
          description: 'Create the basic project structure with TypeScript configuration',
          priority: 'high',
          estimatedHours: 2
        },
        {
          title: 'Implement Authentication',
          description: 'Add GitHub OAuth authentication to the application',
          priority: 'critical',
          estimatedHours: 6
        },
        {
          title: 'Create Database Schema',
          description: 'Design and implement PostgreSQL database schema for projects and tasks',
          priority: 'high',
          estimatedHours: 4
        },
        {
          title: 'Build API Endpoints',
          description: 'Create REST API endpoints for project and task management',
          priority: 'medium',
          estimatedHours: 8
        },
        {
          title: 'Add Unit Tests',
          description: 'Write comprehensive unit tests for all functionality',
          priority: 'medium',
          estimatedHours: 6
        }
      ])
    }],
    usage: {
      input_tokens: 150,
      output_tokens: 200
    }
  },

  parsingError: {
    error: {
      type: 'invalid_request_error',
      message: 'Invalid API key provided'
    }
  },

  malformedResponse: {
    content: [{
      type: 'text',
      text: 'This is not valid JSON and should trigger fallback parsing'
    }]
  }
};

// Setup fetch mock for Anthropic API
export function setupAnthropicMock(responseType: 'success' | 'error' | 'malformed' = 'success') {
  const mockFetch = vi.fn();

  mockFetch.mockImplementation(async (url: string, options: any) => {
    // Only mock Anthropic API calls
    if (!url.includes('api.anthropic.com')) {
      return Promise.reject(new Error('Unmocked fetch call'));
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    switch (responseType) {
      case 'error':
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve(mockAnthropicResponses.parsingError)
        });

      case 'malformed':
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockAnthropicResponses.malformedResponse)
        });

      case 'success':
      default:
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockAnthropicResponses.successfulParsing)
        });
    }
  });

  // Replace global fetch
  global.fetch = mockFetch;
  return mockFetch;
}

// Mock PRP Parser class
export function createMockPRPParser(responseType: 'success' | 'error' | 'malformed' = 'success') {
  const mockParser = {
    generateTasksFromPRP: vi.fn(),
    buildPRPParsingPrompt: vi.fn(),
    validateAndNormalizeTasks: vi.fn(),
    parsePreviewPRP: vi.fn()
  };
  
  // Add static methods
  mockParser.validatePRPContent = vi.fn().mockReturnValue({ isValid: true, errors: [] });
  mockParser.sanitizePRPContent = vi.fn().mockImplementation((content) => content.trim());

  // Setup generateTasksFromPRP behavior
  switch (responseType) {
    case 'error':
      mockParser.generateTasksFromPRP.mockRejectedValue(new Error('API authentication failed'));
      break;

    case 'malformed':
      mockParser.generateTasksFromPRP.mockResolvedValue([
        {
          title: 'Fallback Implementation Task 1',
          description: 'Generated from fallback parsing with validation gates',
          priority: 'medium',
          estimatedHours: 4
        }
      ]);
      break;

    case 'success':
    default:
      mockParser.generateTasksFromPRP.mockResolvedValue([
        {
          title: 'Setup Project Structure with TypeScript',
          description: 'Create the basic project structure with TypeScript configuration and linting setup',
          priority: 'high',
          estimatedHours: 2
        },
        {
          title: 'Implement Authentication with JWT',
          description: 'Add JWT-based authentication system with login/register endpoints and validation',
          priority: 'critical',
          estimatedHours: 6
        },
        {
          title: 'Create Database Schema with Tests',
          description: 'Design and implement PostgreSQL database schema with comprehensive unit tests',
          priority: 'high',
          estimatedHours: 4
        }
      ]);
      break;
  }

  return mockParser;
}

// Mock validation functions
export const mockValidation = {
  validPRP: {
    isValid: true,
    errors: []
  },
  
  invalidPRP: {
    isValid: false,
    errors: [
      'PRP content is too short to be meaningful',
      'PRP content should contain implementation instructions, code patterns, or technical specifications'
    ]
  },

  emptyPRP: {
    isValid: false,
    errors: ['PRP content cannot be empty']
  }
};