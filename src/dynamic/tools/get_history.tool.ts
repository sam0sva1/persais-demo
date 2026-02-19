/**
 * get_history Tool
 * Created by Mechanic on 2026-02-19
 */

import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { DynamicTool, ToolExecutionContext } from '../core/tools/base';
import { db } from '../core/db';
import { romantic_echo } from '../schema/romantic_echo';

/**
 * Agents that can use this tool
 */
export const allowedAgents: string[] = ['romantic'];

/**
 * Input validation schema
 */
const inputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(5).describe('Number of messages to return'),
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

export class GetHistoryTool extends DynamicTool<Input, Output> {
  name = 'get_history';
  description = 'Retrieves the most recent romantic messages from history';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      const messages = await db
        .select()
        .from(romantic_echo)
        .where(eq(romantic_echo.isDeleted, false))
        .orderBy(desc(romantic_echo.timestamp))
        .limit(input.limit);

      return {
        success: true,
        data: messages,
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

export default new GetHistoryTool();
