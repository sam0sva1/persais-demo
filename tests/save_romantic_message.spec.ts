/**
 * Tests for save_romantic_message
 * Created by Mechanic on 2026-02-23
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import tool from '../src/tools/save_romantic_message.tool';

// Mock the database
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockDb = {
  insert: mockInsert,
};

vi.mock('persais-core', async () => {
  const actual = await vi.importActual('persais-core');
  return {
    ...actual,
    getDb: () => mockDb,
  };
});

describe('save_romantic_message', () => {
  const testContext = {
    userId: 123456,
    chatId: 123456,
    agentName: 'романтик',
  };

  beforeAll(async () => {
    // Setup: clean test data
  });

  afterAll(async () => {
    // Cleanup: remove test data
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('save_romantic_message');
  });

  it('should have valid schema', () => {
    expect(tool.schema).toBeDefined();
  });

  it('should handle invalid input', async () => {
    const result = await tool.safeExecute({}, testContext);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should save a romantic message successfully', async () => {
    const testMessage = 'Ты прекрасна как звезда!';
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const result = await tool.safeExecute(
      { message: testMessage },
      testContext
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      chatId: testContext.chatId,
      message: testMessage,
    });
  });

  it('should handle empty message', async () => {
    const result = await tool.safeExecute(
      { message: '' },
      testContext
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
