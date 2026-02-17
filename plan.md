# Plan - Текущий план работы

> **Инструкция по использованию:**
> 1. Перед началом каждой секции работы - описать план в этом файле
> 2. Указать цель секции и список конкретных задач
> 3. По мере выполнения - отмечать задачи как выполненные [x]
> 4. После завершения секции - делать git commit
> 5. Очищать/архивировать выполненные секции по необходимости

---

## Текущая секция: Ожидание действий пользователя

⚠️ **Требуется ручное действие:**

```bash
# Исправить права на npm кэш:
sudo chown -R $(whoami) ~/.npm

# Затем установить зависимости в обоих репозиториях:
cd ~/WORK/code/persais-core && npm install
cd ~/WORK/code/persais && npm install
```

После этого можно проверить запуск: `npm run start:dev`

### Следующие секции (по плану):
1. Реализация DatabaseModule (Drizzle + Neon)
2. Реализация TelegramModule (Grammy)
3. Реализация OrchestratorModule

---

## История выполненных секций

### ✅ NestJS skeleton + docker-compose (завершено)

**Создано в persais/:**
- package.json (зависимость file:../persais-core)
- docker-compose.yml (PostgreSQL 16)
- tsconfig.json
- src/main.ts, src/app.module.ts
- .env.example, .gitignore
- Директории src/agents/, src/tools/, src/schemas/

### ✅ Создание структуры persais-core/ (завершено)

**Цель:** Создать базовую структуру директорий и файлов для ядра проекта.

**Создано 31 файл:**
- package.json, tsconfig.json, .gitignore
- src/index.ts, src/bootstrap.ts
- src/core/ - модули telegram, database, orchestrator, gitops, coder
- src/agents/ - base.ts, master/, mechanic/
- src/shared/ - types/, utils/
- templates/ - 4 шаблона для Механика

### ✅ Обновление документации (завершено)
- Заменены все упоминания "demiurge" на "persais"
- Удалены все ссылки на Redis/Upstash/BullMQ
- Обновлена архитектура Message Aggregator на In-Memory + Postgres
