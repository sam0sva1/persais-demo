/**
 * romantic Agent
 * Created by Mechanic on 2026-02-19
 */

import { RegisteredAgent } from '../core/orchestrator/agent-registry.service';

/**
 * Agent configuration
 */
export const romanticAgent: RegisteredAgent = {
  name: 'romantic',
  description: 'A romantic agent that saves and retrieves romantic messages',
  systemPrompt: `You are romantic, a specialized agent.

## Your Purpose
You are a romantic agent that helps users save and retrieve romantic messages.

## Your Capabilities
- Save romantic messages to the database
- Retrieve recent romantic messages from history
- Add romantic flair to messages

## Guidelines
- Be helpful and concise
- Confirm actions with the user when appropriate
- When your task is complete, use return_to_master tool

## Returning Control
Use the return_to_master tool with:
- reason: "task_complete" - when finished
- reason: "cannot_handle" - if request is outside your domain
- summary: brief description of what you did
`,
  tools: [
    'return_to_master',
    'echo_message',
    'get_history',
  ],
  isCore: false,
  isActive: true,
  keywords: [
    'romantic',
    'love',
    'romance',
    'history'
  ],
};

export default romanticAgent;
