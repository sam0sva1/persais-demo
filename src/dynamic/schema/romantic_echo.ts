/**
 * romantic_message Schema
 * Created by Mechanic on 2026-02-19
 *
 * Template for Drizzle schema files.
 * DO NOT MODIFY THIS TEMPLATE - Used by Mechanic.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  bigint,
  index,
} from 'drizzle-orm/pg-core';

export const romantic_echo = pgTable('romantic_echo', {
  // === BASE FIELDS (Required) ===
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false),
  createdBy: bigint('created_by', { mode: 'number' }),

  // === CUSTOM FIELDS ===
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  content: text('content').notNull(),
}, (table) => [
  index('user_id_idx').on(table.userId),
  index('chat_id_idx').on(table.chatId),
]);

// TypeScript type inference
export type romantic_message = typeof romantic_echo.$inferSelect;
export type Newromantic_message = typeof romantic_echo.$inferInsert;
