/**
 * romantic_messages Schema
 * Created by Mechanic on 2026-02-23
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const romanticMessages = pgTable('romantic_messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  message: text('message').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => ({
  chatIdIdx: index('romantic_messages_chat_id_idx').on(table.chatId),
}));

// TypeScript type inference
export type RomanticMessage = typeof romanticMessages.$inferSelect;
export type NewRomanticMessage = typeof romanticMessages.$inferInsert;
