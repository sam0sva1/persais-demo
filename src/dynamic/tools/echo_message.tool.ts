/**
 * echo_message Tool
 * Created by Mechanic on 2026-02-19
 */

import { z } from 'zod';
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
  message: z.string().min(1).describe('Message to echo'),
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

export class EchoMessageTool extends DynamicTool<Input, Output> {
  name = 'echo_message';
  description = 'Saves a romantic message to database and returns it with romantic flair';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      const result = await db.insert(romantic_echo).values({
        message: input.message,
        createdBy: context.userId,
      }).returning();

      const romanticMessage = `${input.message}\n\nО Боги! Как же это романтично!`;

      return {
        success: true,
        data: result[0],
        message: romanticMessage,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new EchoMessageTool();
