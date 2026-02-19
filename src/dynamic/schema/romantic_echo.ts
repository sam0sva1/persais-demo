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
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  jsonb,
} from 'drizzle-orm/pg-core';

export const romantic_echo = pgTable('romantic_echo', {
  // === BASE FIELDS (Required) ===
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false),
  createdBy: bigint('created_by', { mode: 'number' }),

  // === CUSTOM FIELDS ===
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

// TypeScript type inference
export type romantic_message = typeof romantic_echo.$inferSelect;
export type Newromantic_message = typeof romantic_echo.$inferInsert;
