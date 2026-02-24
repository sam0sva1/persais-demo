## Task: Implement Romantic Agent

### Description
Create a new agent named "романтик" that acts as an echo agent with a romantic twist.
It should save incoming messages, append "О Боже! Как это романтично!" and send it back to the user.
It should also be able to return the last 5 (or N) recorded phrases upon request.

### Files to be created/modified:
- `src/schemas/romantic_messages.ts`
- `src/tools/save_romantic_message.tool.ts`
- `src/tools/get_romantic_messages.tool.ts`
- `src/agents/романтик.agent.ts`
- `tests/save_romantic_message.spec.ts`
- `tests/get_romantic_messages.spec.ts`

### [AIDER] Implementation Details:
1.  **Schema (`src/schemas/romantic_messages.ts`):**
    *   Table name: `romantic_messages`
    *   Columns:
        *   `id`: `uuid`, primary key, default `gen_random_uuid()`
        *   `chatId`: `bigint`, not null, index
        *   `message`: `text`, not null
        *   `timestamp`: `timestamp`, not null, default `now()`
    *   Export types: `RomanticMessage`, `NewRomanticMessage`

2.  **Tool `save_romantic_message` (`src/tools/save_romantic_message.tool.ts`):**
    *   Input: `{ message: string }`
    *   Functionality: Inserts a new message into the `romantic_messages` table.
    *   `allowedAgents`: `['романтик']`

3.  **Tool `get_romantic_messages` (`src/tools/get_romantic_messages.tool.ts`):**
    *   Input: `{ limit?: number }` (default to 5 if not provided)
    *   Functionality: Retrieves the last `limit` messages for the current `chatId` from the `romantic_messages` table, ordered by `timestamp` descending.
    *   `allowedAgents`: `['романтик']`

4.  **Agent `романтик` (`src/agents/романтик.agent.ts`):**
    *   `description`: "Агент, который добавляет романтики в ваши сообщения и запоминает их."
    *   `tools`: `['save_romantic_message', 'get_romantic_messages']`
    *   `instruction`:
        *   При получении сообщения:
            *   Сохранить оригинальное сообщение с помощью `save_romantic_message`.
            *   Сформировать ответ: оригинальное сообщение + "О Боже! Как это романтично!"
            *   Отправить ответ пользователю.
        *   При запросе "верни последние фразы" или "покажи историю":
            *   Использовать `get_romantic_messages` (с `limit` из запроса, если указано, иначе 5).
            *   Сформировать список сообщений и отправить пользователю.

### [AIDER] Test Details:
1.  **`save_romantic_message.spec.ts`:**
    *   Test that the tool successfully inserts a message into the database.
    *   Verify the `chatId`, `message`, and `timestamp` are correctly stored.
2.  **`get_romantic_messages.spec.ts`:**
    *   Test that the tool retrieves the correct number of messages.
    *   Test that messages are ordered by `timestamp` descending.
    *   Test with and without a `limit` parameter.
