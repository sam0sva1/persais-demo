# Секция 4a: Голосовые сообщения (Deepgram)

## Scope
Простая поддержка голосовых сообщений через Deepgram Speech-to-Text.

---

## Архитектура

```
┌─────────────┐     voice message      ┌─────────────┐
│  Telegram   │ ─────────────────────► │   Grammy    │
│   User      │                        │  Webhook    │
└─────────────┘                        └──────┬──────┘
                                              │
                                              │ download audio (ogg)
                                              ▼
                                       ┌─────────────┐
                                       │  Deepgram   │
                                       │    API      │
                                       └──────┬──────┘
                                              │
                                              │ transcript (text)
                                              ▼
                                       ┌─────────────┐
                                       │  Save as    │
                                       │  text msg   │
                                       │  to DB      │
                                       └──────┬──────┘
                                              │
                                              │ process as usual
                                              ▼
                                       ┌─────────────┐
                                       │  Agent      │
                                       │  Pipeline   │
                                       └─────────────┘
```

---

## Flow

1. **Получение голосового сообщения** из Telegram (формат: OGG/Opus)
2. **Download аудио файла** через Telegram API
3. **Отправка в Deepgram API** (stream или batch)
4. **Получение транскрипта**
5. **Сохранение как текстовое сообщение** в БД
6. **Обработка через стандартный agent pipeline**

---

## Реализация

```typescript
// core/telegram/voice.handler.ts

import { Deepgram } from '@deepgram/sdk';
import { Bot } from 'grammy';

@Injectable()
export class VoiceMessageHandler {
  private deepgram: Deepgram;

  constructor(
    @Inject('TELEGRAM_BOT') private bot: Bot,
    private configService: ConfigService,
    private messageService: MessageService,
  ) {
    this.deepgram = new Deepgram(configService.get('DEEPGRAM_API_KEY'));
  }

  async handleVoiceMessage(ctx: Context): Promise<string> {
    const voice = ctx.message?.voice;
    if (!voice) throw new Error('No voice message');

    // 1. Download audio from Telegram
    const file = await ctx.api.getFile(voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${this.configService.get('TELEGRAM_BOT_TOKEN')}/${file.file_path}`;

    const audioResponse = await fetch(fileUrl);
    const audioBuffer = await audioResponse.arrayBuffer();

    // 2. Send to Deepgram
    const { result } = await this.deepgram.listen.prerecorded.transcribeFile(
      Buffer.from(audioBuffer),
      {
        model: 'nova-2',
        language: 'ru', // или 'en', или auto-detect
        smart_format: true,
      }
    );

    // 3. Extract transcript
    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';

    if (!transcript) {
      throw new Error('Failed to transcribe voice message');
    }

    // 4. Save as text message and process
    await this.messageService.saveAndProcess({
      userId: ctx.from!.id,
      chatId: ctx.chat!.id,
      content: transcript,
      metadata: {
        source: 'voice',
        originalFileId: voice.file_id,
        duration: voice.duration,
      },
    });

    return transcript;
  }
}
```

---

## Telegram Handler

```typescript
// В telegram.controller.ts

bot.on('message:voice', async (ctx) => {
  try {
    // Показываем "typing" пока обрабатываем
    await ctx.api.sendChatAction(ctx.chat.id, 'typing');

    const transcript = await voiceHandler.handleVoiceMessage(ctx);

    // Опционально: показать пользователю что мы распознали
    // await ctx.reply(`🎤 "${transcript}"`, { reply_to_message_id: ctx.message.message_id });

    // Дальше обработка идёт через стандартный pipeline
    // messageService.saveAndProcess уже вызывает агентов

  } catch (error) {
    await ctx.reply('❌ Не удалось распознать голосовое сообщение');
  }
});
```

---

## Environment Variables

```bash
# Deepgram
DEEPGRAM_API_KEY=xxx
```

---

## Особенности

### Простота
- Нет сложной обработки аудио
- Нет streaming (batch запросы)
- Нет очередей для аудио

### Ограничения
- Telegram voice messages до 1 час (обычно намного короче)
- Deepgram обрабатывает OGG/Opus напрямую
- Синхронная обработка (ждём ответ от Deepgram)

### Язык
- По умолчанию: русский (`ru`)
- Можно сделать auto-detect или настраиваемым

---

## Definition of Done

- [ ] Deepgram SDK установлен
- [ ] VoiceMessageHandler создан
- [ ] Grammy обрабатывает voice messages
- [ ] Транскрипт сохраняется как текстовое сообщение
- [ ] Сообщение проходит через agent pipeline
- [ ] Ошибки обрабатываются gracefully
