/**
 * Persais - Main Entry Point
 *
 * This is the user project that uses persais-core.
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { bootstrap, PersaisConfig } from 'persais-core';

// Load environment variables
config();

async function main() {
  const persaisConfig: PersaisConfig = {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN!,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      allowedUserIds: (process.env.TELEGRAM_ALLOWED_USERS || '')
        .split(',')
        .filter(Boolean)
        .map(Number),
      adminUserIds: (process.env.TELEGRAM_ADMIN_USERS || '')
        .split(',')
        .filter(Boolean)
        .map(Number),
    },
    database: {
      url: process.env.DATABASE_URL!,
    },
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultModel: process.env.DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
      classifierModel:
        process.env.CLASSIFIER_MODEL || 'anthropic/claude-3-haiku',
    },
    deepgram: process.env.DEEPGRAM_API_KEY
      ? {
          apiKey: process.env.DEEPGRAM_API_KEY,
          language: process.env.DEEPGRAM_LANGUAGE || 'ru',
        }
      : undefined,
    git: process.env.GIT_REMOTE_URL
      ? {
          remoteUrl: process.env.GIT_REMOTE_URL,
          accessToken: process.env.GIT_ACCESS_TOKEN!,
        }
      : undefined,
    // Dynamic code directories (relative to this project)
    agentsDir: './src/agents',
    toolsDir: './src/tools',
    schemasDir: './src/schemas',
  };

  try {
    const app = await bootstrap(persaisConfig);
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`🚀 Persais is running on port ${port}`);
  } catch (error) {
    console.error('Failed to start Persais:', error);
    process.exit(1);
  }
}

main();
