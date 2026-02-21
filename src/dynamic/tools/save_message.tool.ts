/**
 * save_message Tool
 * Created by Mechanic on 2026-02-19
 */

import { z } from 'zod';
import { DynamicTool, ToolExecutionContext, getDb } from 'persais-core';
import { romantic_echo } from '../schema/romantic_echo';

/**
 * Agents that can use this tool
 */
export const allowedAgents: string[] = ['romantic'];

/**
 * Input validation schema
 */
const inputSchema = z.object({
  content: z.string().min(1).describe('The message content to save'),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Output type
 */
interface Output {
  success: boolean;
  data?: { id: string };
  message?: string;
  error?: string;
}

export class SaveMessageTool extends DynamicTool<Input, Output> {
  name = 'save_message';
  description = 'Save a message to the romantic echo database';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      const db = getDb();

      const result = await db.insert(romantic_echo as any).values({
        userId: context.userId,
        chatId: context.chatId,
        content: input.content,
        createdBy: context.userId,
      }).returning();

      return {
        success: true,
        data: { id: (result as any)[0].id },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new SaveMessageTool();
