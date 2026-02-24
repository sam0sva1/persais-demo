/**
 * get_romantic_messages Tool
 * Created by Mechanic on 2026-02-23
 */

import { z } from 'zod';
import { DynamicTool, ToolExecutionContext, getDb } from 'persais-core';
import { romanticMessages } from '../schemas/romantic_messages';
import { eq, desc } from 'drizzle-orm';

/**
 * Agents that can use this tool
 */
export const allowedAgents: string[] = ['романтик'];

/**
 * Input validation schema
 */
const inputSchema = z.object({
  limit: z.coerce.number().int().positive().optional().default(5).describe('Number of messages to retrieve (default: 5)'),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Output type
 */
interface Output {
  success: boolean;
  data?: string[];
  message?: string;
  error?: string;
}

export class GetRomanticMessagesTool extends DynamicTool<Input, Output> {
  name = 'get_romantic_messages';
  description = 'Retrieves the last N romantic messages for the current chat';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      const db = getDb();
      
      const messages = await db
        .select({ message: romanticMessages.message })
        .from(romanticMessages)
        .where(eq(romanticMessages.chatId, context.chatId))
        .orderBy(desc(romanticMessages.timestamp))
        .limit(input.limit);

      return {
        success: true,
        data: messages.map(m => m.message),
        message: `Retrieved ${messages.length} romantic messages`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new GetRomanticMessagesTool();
