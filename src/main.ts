/**
 * Persais - Main Entry Point
 *
 * This is the user project that uses persais-core.
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { bootstrap, parseEnv, type PersaisConfig } from 'persais-core';

// Load environment variables
config();

async function main() {
  // Validate and parse all env vars at startup — fails fast with clear error messages.
  // See: persais-core/src/config/env.schema.ts for all available options.
  const env = parseEnv();

  const persaisConfig: PersaisConfig = {
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN,
      webhookUrl: env.TELEGRAM_WEBHOOK_URL,
      registrationSecret: env.TELEGRAM_REGISTRATION_SECRET,
    },
    database: {
      url: env.DATABASE_URL,
    },
    openRouter: {
      apiKey: env.OPENROUTER_API_KEY,
      defaultModel: env.DEFAULT_MODEL,
      classifierModel: env.CLASSIFIER_MODEL,
      fallbackModel: env.FALLBACK_MODEL,
      timeoutMs: env.MODEL_TIMEOUT,
      providerOrder: env.OPENROUTER_PROVIDER_ORDER
        ? env.OPENROUTER_PROVIDER_ORDER.split(',').map((s) => s.trim())
        : undefined,
      allowFallbacks: env.OPENROUTER_ALLOW_FALLBACKS,
      spawnTimeoutMs: env.AGENT_SPAWN_TIMEOUT,
    },
    deepgram: env.DEEPGRAM_API_KEY
      ? { apiKey: env.DEEPGRAM_API_KEY }
      : undefined,
    git: env.GIT_REMOTE_URL
      ? {
          remoteUrl: env.GIT_REMOTE_URL,
          accessToken: env.GIT_ACCESS_TOKEN!,
        }
      : undefined,
    // Dynamic code directories (relative to this project)
    agentsDir: './src/agents',
    toolsDir: './src/tools',
    schemasDir: './src/schemas',
    port: env.PORT,
  };

  try {
    const app = await bootstrap(persaisConfig);
    await app.listen(env.PORT);
    console.log(`Persais is running on port ${env.PORT}`);
  } catch (error) {
    console.error('Failed to start Persais:', error);
    process.exit(1);
  }
}

main();
