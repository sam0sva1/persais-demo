# Agent Catalog

Описания конкретных агентов для Persais. Для каждого: поведение, tools, gaps, что нужно для реализации.

## Общая инфраструктура — что доступно

| Компонент | Статус | Доступ light agents |
|-----------|--------|---------------------|
| `agent_memory` | Готов | L2 автоматически |
| `agent_knowledge` | Готов | Через `tools: ['agent_knowledge']` |
| `http_request` | Готов | Через `tools: ['http_request']` |
| `manage_schedule` | Готов | Через `tools: ['manage_schedule']` |
| `web_search` / `web_extract` | Готов | Через `tools: ['web_search', 'web_extract']` |
| `manage_agents` | Готов | master + mechanic (privileged, не shareable) |
| Scheduler webhook pipeline | Готов | Cronos → `POST /scheduler/webhook` → HMAC → `InputFunnelService.handleInternal()` → Master → Agent |
| Incoming webhooks (generic) | Нет | Внешние сервисы (не Cronos) не могут вызвать агента напрямую |

### Что нужно доработать (общее)

1. **`list_tags` в `agent_knowledge`** — `SELECT DISTINCT unnest(tags)` для агентов, работающих с тегами
2. Обдумать generic incoming webhooks (для сервисов кроме Cronos)

## Агенты

| # | Агент | Файл | Уровень | Готовность |
|---|-------|------|---------|------------|
| 1 | Заметки (Notes) | [01-notes.md](01-notes.md) | L2 | ~95% |
| 2 | Писательский (Writing) | [02-writing.md](02-writing.md) | L2 | ~85% |
| 3 | Идеи проектов (Project Ideas) | [03-project-ideas.md](03-project-ideas.md) | L2 | ~95% |
| 4 | Сайд квесты (Side Quests) | [04-side-quests.md](04-side-quests.md) | L1→L2 | ~95% |
| 5 | Облигации (Bonds List) | [05-bonds-list.md](05-bonds-list.md) | L1 | ~90% |
| 6 | Доступность облигации (Bond Availability) | [06-bond-availability.md](06-bond-availability.md) | L1 | ~95% |
| 7 | Проверка курса (Exchange Rate) | [07-exchange-rate.md](07-exchange-rate.md) | L1 | ~95% |
| 8 | Здоровье (Health Tracker) | [08-health-tracker.md](08-health-tracker.md) | L2 | ~75% |


## Отдельные идеи

- [mechanic-handlers.md](mechanic-handlers.md) — Mechanic как создатель не только агентов, но и алгоритмических обработчиков
