/**
 * get_messages Tool
 * Created by Mechanic on 2026-02-19
 */

import { z } from 'zod';
import { DynamicTool, ToolExecutionContext, getDb } from 'persais-core';

/**
 * Input validation schema
 */
const inputSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().describe('Number of messages to retrieve'),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Output Type
 */
interface Output {
  success: boolean;
  data?: { messages: Array<{ id: string; content: string; createdAt: Date }> };
  message?: string;
  error?: string;
}

export class GetMessagesTool extends DynamicTool<Input, Output> {
  name = 'get_messages';
  description = 'Get recent messages from the romantic echo database';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      const db = getDb();
      const limit = input.limit ?? 5;

      const result = await db.execute(`
        SELECT id, content, created_at as "createdAt" 
        FROM romantic_echo 
        WHERE chat_id = ${context.chatId} 
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `);

      const messages = (result.rows as any[]).map((row: any) => ({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
      }));

      return {
        success: true,
        data: { messages },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new GetMessagesTool();
