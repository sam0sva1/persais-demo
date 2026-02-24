/**
 * Tests for get_romantic_messages
 * Created by Mechanic on 2026-02-23
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import tool from '../src/tools/get_romantic_messages.tool';

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

const mockDb = {
  select: mockSelect,
};

vi.mock('persais-core', async () => {
  const actual = await vi.importActual('persais-core');
  return {
    ...actual,
    getDb: () => mockDb,
  };
});

describe('get_romantic_messages', () => {
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
    expect(tool.name).toBe('get_romantic_messages');
  });

  it('should have valid schema', () => {
    expect(tool.schema).toBeDefined();
  });

  it('should use default limit of 5', async () => {
    const mockMessages = [
      { message: 'Ты прекрасна!' },
      { message: 'Какой чудесный день!' },
    ];

    mockLimit.mockResolvedValue(mockMessages);
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await tool.safeExecute({}, testContext);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(['Ты прекрасна!', 'Какой чудесный день!']);
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('should use custom limit when provided', async () => {
    const mockMessages = [
      { message: 'Сообщение 1' },
      { message: 'Сообщение 2' },
      { message: 'Сообщение 3' },
    ];

    mockLimit.mockResolvedValue(mockMessages);
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await tool.safeExecute({ limit: 3 }, testContext);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(['Сообщение 1', 'Сообщение 2', 'Сообщение 3']);
    expect(mockLimit).toHaveBeenCalledWith(3);
  });

  it('should handle empty result', async () => {
    mockLimit.mockResolvedValue([]);
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await tool.safeExecute({}, testContext);

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('should reject negative limit', async () => {
    const result = await tool.safeExecute({ limit: -1 }, testContext);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
