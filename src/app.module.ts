/**
 * AppModule - Root NestJS Module
 *
 * This module is created by persais-core bootstrap(),
 * but we can extend it here if needed for user-specific modules.
 */

import { Module } from '@nestjs/common';

@Module({
  imports: [
    // persais-core modules are imported automatically via bootstrap()
    // Add user-specific modules here if needed
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
