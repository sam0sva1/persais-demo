# Сайд квесты (Side Quests)

## Оригинальное описание

> Присылает каждый день 3 простых сайд квеста: например, пройтись по знакомым местам без наушников, сфотографировать 5 разных текстур, посидеть молча 5 минут на лавочке в парке. Усиленный: сохраняет то, что было предложено и то, что было сделано.

## Анализ

### Базовая версия (L1)

`manage_schedule` создаёт ежедневный cron job → Cronos fire → `POST /scheduler/webhook` → `InputFunnelService.handleInternal(chatId, actionPrompt, 'timer')` → Master → агент генерирует 3 квеста → `send_message`.

Чисто proactive, без memory. Но есть вопрос: кто создаёт schedule? Варианты:
- **При установке**: Master через `manage_schedule` сам ставит cron
- **Агент сам**: если у агента есть `manage_schedule`, он может создать себе расписание при первом взаимодействии

### Усиленная версия (L2)

`agent_memory` для хранения предложенных квестов (collection: `quests`, key: дата) и выполненных (collection: `completed`). Агент при генерации проверяет историю, чтобы не повторяться.

### Scheduler pipeline (уже работает)

```
Cronos timer fires
  → POST /scheduler/webhook { jobId, token }
  → HMAC verify → DB lookup → executeAction()
  → InputFunnelService.handleInternal(chatId, actionPrompt, 'timer', { targetAgent: 'master' })
  → Master получает сообщение с source='timer'
  → Master решает, какому агенту передать (или выполняет сам)
```

**Важный нюанс**: scheduler сейчас отправляет сообщение на **Master**, не на конкретного агента. Master должен понять, что это для side_quests и переключиться. Это работает, потому что `actionPrompt` содержит контекст.

## Что есть в системе

| Компонент | Статус |
|-----------|--------|
| `manage_schedule` tool | Готов |
| Cronos → webhook → agent pipeline | Готов, полностью работает |
| `agent_memory` (для L2) | Готов |
| `manage_schedule` в CAPABILITY_TOOLS | Готов |

## Что нужно для реализации

1. Написать промпт (генерация квестов, разнообразие, difficulty levels)
3. При установке (или первом общении) — агент создаёт cron job
4. `manage_agents.install(manifest)`

## Предварительная оценка

| Аспект | Значение |
|--------|----------|
| Уровень (базовый) | L1 |
| Уровень (усиленный) | L2 |
| Tools | `manage_schedule`, (agent_memory для L2) |
| Proactive | Да — ежедневный cron trigger |
| Готовность системы | ~95% |
| Сложность реализации | Низкая |
