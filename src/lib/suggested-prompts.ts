// src/lib/suggested-prompts.ts
export interface SuggestedPrompt {
  id: string
  label: string
  prompt: string
  category:
    | 'coding'
    | 'writing'
    | 'analysis'
    | 'debugging'
    | 'planning'
    | 'brainstorming'
}

export const suggestedPrompts: SuggestedPrompt[] = [
  // Coding
  {
    id: 'c1',
    label: 'Review my code',
    prompt:
      'Review the following code for bugs, performance issues, and style improvements:',
    category: 'coding'
  },
  {
    id: 'c2',
    label: 'Write unit tests',
    prompt: 'Write comprehensive unit tests for the following function/module:',
    category: 'coding'
  },
  {
    id: 'c3',
    label: 'Refactor this',
    prompt:
      'Refactor the following code to be cleaner, more maintainable, and follow best practices:',
    category: 'coding'
  },
  {
    id: 'c4',
    label: 'Add error handling',
    prompt: 'Add proper error handling and validation to the following code:',
    category: 'coding'
  },
  {
    id: 'c5',
    label: 'Explain this code',
    prompt:
      'Explain what this code does step by step, as if I am a junior developer:',
    category: 'coding'
  },
  {
    id: 'c6',
    label: 'Write a function',
    prompt: 'Write a function that',
    category: 'coding'
  },
  // Writing
  {
    id: 'w1',
    label: 'Write documentation',
    prompt: 'Write clear, concise documentation for the following code/module:',
    category: 'writing'
  },
  {
    id: 'w2',
    label: 'Draft a README',
    prompt:
      'Draft a comprehensive README for this project including installation, usage, and contribution guidelines:',
    category: 'writing'
  },
  {
    id: 'w3',
    label: 'Write a commit message',
    prompt: 'Write a conventional commit message for the following changes:',
    category: 'writing'
  },
  {
    id: 'w4',
    label: 'Summarize this',
    prompt: 'Summarize the following in 2-3 clear sentences:',
    category: 'writing'
  },
  // Analysis
  {
    id: 'a1',
    label: 'Compare approaches',
    prompt:
      'Compare the following two approaches, discussing trade-offs in performance, maintainability, and complexity:',
    category: 'analysis'
  },
  {
    id: 'a2',
    label: 'Identify risks',
    prompt: 'Identify potential risks and edge cases in the following:',
    category: 'analysis'
  },
  {
    id: 'a3',
    label: 'Architecture review',
    prompt: 'Review the architecture of this project and suggest improvements:',
    category: 'analysis'
  },
  // Debugging
  {
    id: 'd1',
    label: 'Fix this error',
    prompt:
      'I am getting the following error. Help me understand why and how to fix it:',
    category: 'debugging'
  },
  {
    id: 'd2',
    label: 'Debug this test',
    prompt: 'The following test is failing. Help me debug why:',
    category: 'debugging'
  },
  {
    id: 'd3',
    label: 'Performance issue',
    prompt:
      'The following code is running slowly. Help me identify the bottleneck and suggest optimizations:',
    category: 'debugging'
  },
  // Planning
  {
    id: 'p1',
    label: 'Plan a feature',
    prompt: 'Help me plan the implementation of a new feature:',
    category: 'planning'
  },
  {
    id: 'p2',
    label: 'Break down a task',
    prompt: 'Break down the following task into smaller, actionable steps:',
    category: 'planning'
  },
  {
    id: 'p3',
    label: 'Create a migration plan',
    prompt:
      'Create a migration plan for upgrading from the current version to the target version:',
    category: 'planning'
  },
  // Brainstorming
  {
    id: 'b1',
    label: 'Brainstorm ideas',
    prompt: 'Brainstorm ideas for:',
    category: 'brainstorming'
  },
  {
    id: 'b2',
    label: 'Name this',
    prompt: 'Suggest names for:',
    category: 'brainstorming'
  }
]
