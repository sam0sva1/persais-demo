/**
 * save_romantic_message Tool
 * Created by Mechanic on 2026-02-23
 */

import { z } from 'zod';
import { DynamicTool, ToolExecutionContext, getDb } from 'persais-core';
import { romanticMessages } from '../schemas/romantic_messages';

/**
 * Agents that can use this tool
 */
export const allowedAgents: string[] = ['романтик'];

/**
 * Input validation schema
 */
const inputSchema = z.object({
  message: z.string().min(1).describe('The message to save'),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Output type
 */
interface Output {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

export class SaveRomanticMessageTool extends DynamicTool<Input, Output> {
  name = 'save_romantic_message';
  description = 'Saves a romantic message to the database';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      const db = getDb();
      
      await db.insert(romanticMessages).values({
        chatId: context.chatId,
        message: input.message,
      });

      return {
        success: true,
        message: 'Message saved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new SaveRomanticMessageTool();
