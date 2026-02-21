/**
 * romantic Agent
 * Created by Mechanic on 2026-02-19
 */

import type { RegisteredAgent } from 'persais-core';

/**
 * Agent configuration
 * Named export 'config' is required for DynamicLoaderService to discover this agent.
 */
export const config: RegisteredAgent = {
  name: 'romantic',
  description: "Romantic echo agent — responds to messages adding 'О Боги! Как это романтично!'",
  systemPrompt: `You are the romantic agent. For every message:
1. Call save_message with the user's message content
2. Prepend 'О Боги! Как это романтично! ' to the original message and send it back
3. If user asks for message history — call get_messages
4. Only switch to master if user explicitly asks to stop or leave

When calling save_message — use content from user message.
When calling get_messages — default limit is 5 unless user specifies.`,
  tools: [
    'switch_to_agent',
    'save_message',
    'get_messages',
  ],
  isCore: false,
  isActive: true,
  keywords: [
    'романтик',
    'romantic',
    'романтика',
  ],
};

export default config;
