# Plan - Текущий план работы

> **Инструкция по использованию:**
> 1. Перед началом каждой секции работы - описать план в этом файле
> 2. Указать цель секции и список конкретных задач
> 3. По мере выполнения - отмечать задачи как выполненные [x]
> 4. После завершения секции - делать git commit
> 5. Очищать/архивировать выполненные секции по необходимости

---

## Текущая секция: Настройка npm link + docker-compose + NestJS skeleton

### Цель
Связать два репозитория через npm link, создать docker-compose для локальной разработки и настроить базовый NestJS skeleton.

### Зачем
- npm link позволяет разрабатывать persais-core локально без публикации в npm
- docker-compose поднимает PostgreSQL для локальной разработки
- NestJS skeleton - основа для запуска приложения

### Задачи

**npm link:**
- [ ] Выполнить `npm link` в persais-core/ ⚠️ требуется `sudo chown -R $(whoami) ~/.npm`
- [x] Создать package.json в persais/ с зависимостью от persais-core (file:../persais-core)
- [ ] Выполнить `npm install` после исправления прав npm
- [ ] Проверить что import работает

**docker-compose:**
- [x] Создать docker-compose.yml в persais/ с PostgreSQL
- [x] Добавить volume для persistence данных
- [x] Добавить health check

**NestJS skeleton в persais/:**
- [x] Создать src/main.ts - точка входа
- [x] Создать src/app.module.ts - корневой модуль
- [x] Создать базовый tsconfig.json
- [x] Создать .env.example
- [x] Создать .gitignore
- [x] Создать директории src/agents/, src/tools/, src/schemas/
- [ ] Проверить что приложение запускается (после npm install)

---

## История выполненных секций

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
