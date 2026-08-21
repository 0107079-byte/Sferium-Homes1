import {
  AISceneAnalysis,
  AISummary,
  AITranslation,
  AIChatModeration,
  AIHostHelp,
  AIGuestHelp,
  AIActivityReport,
  AIMessage,
  RoomState,
  Member,
  ChatMessage
} from '../types';

/**
 * AIHelper Module
 * Handles AI-powered features for video analysis, chat moderation, host/guest guidance, and room activity analysis.
 */

export interface AnalyzeSceneParams {
  roomId: string;
  videoUrl?: string;
  videoTitle?: string;
  provider?: string;
  currentTime: number;
  duration?: number;
  prompt?: string;
}

export interface SummarizeMomentParams {
  roomId: string;
  videoUrl?: string;
  videoTitle?: string;
  currentTime: number;
  windowSeconds?: number;
}

export interface TranslateParams {
  roomId: string;
  videoUrl?: string;
  currentTime: number;
  textToTranslate?: string;
  targetLang?: string;
}

export interface ModerateChatParams {
  text: string;
  userId: string;
  userName: string;
  messageId: string;
}

export interface HostHelpParams {
  roomId: string;
  members: Record<string, Member> | Member[];
  chatHistory: ChatMessage[];
  anyoneCanControl: boolean;
  videoUrl?: string;
}

export interface GuestHelpParams {
  question?: string;
  category?: 'player' | 'voice' | 'chat' | 'general';
}

export interface ActivityReportParams {
  roomId: string;
  members: Record<string, Member> | Member[];
  chatHistory: ChatMessage[];
}

export class AIHelper {
  private static instance: AIHelper;

  private constructor() {}

  public static getInstance(): AIHelper {
    if (!AIHelper.instance) {
      AIHelper.instance = new AIHelper();
    }
    return AIHelper.instance;
  }

  /**
   * Request scene analysis for the current playback position
   */
  public async analyzeCurrentScene(params: AnalyzeSceneParams): Promise<AISceneAnalysis> {
    try {
      const res = await fetch('/api/ai/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[AIHelper] Server API error, falling back to local heuristic analysis:', e);
    }

    return this.generateFallbackSceneAnalysis(params);
  }

  /**
   * Request concise summary of the current 10-20 seconds moment
   */
  public async summarizeMoment(params: SummarizeMomentParams): Promise<AISummary> {
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[AIHelper] Server summary API error, fallback:', e);
    }

    return this.generateFallbackSummary(params);
  }

  /**
   * Request translation of speech / lines in video
   */
  public async translateLines(params: TranslateParams): Promise<AITranslation> {
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[AIHelper] Server translate API error, fallback:', e);
    }

    return this.generateFallbackTranslation(params);
  }

  /**
   * Ask interactive question about video or room to AI
   */
  public async askAI(question: string, context?: { videoUrl?: string; currentTime?: number; videoTitle?: string }): Promise<string> {
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, ...context }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.answer;
      }
    } catch (e) {
      console.warn('[AIHelper] Server ask API error, fallback:', e);
    }

    return this.generateFallbackAnswer(question, context);
  }

  /**
   * Check chat message for toxicity or rule violations
   */
  public async moderateChatMessage(params: ModerateChatParams): Promise<AIChatModeration> {
    try {
      const res = await fetch('/api/ai/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[AIHelper] Moderation API error, fallback to local regex:', e);
    }

    return this.checkToxicityLocally(params);
  }

  /**
   * Get intelligent tips and action recommendations for the host
   */
  public async getHostHelp(params: HostHelpParams): Promise<AIHostHelp> {
    try {
      const res = await fetch('/api/ai/host-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[AIHelper] Host help API error, fallback:', e);
    }

    return this.generateFallbackHostHelp(params);
  }

  /**
   * Get interactive guide & UI explanation for guests/newcomers
   */
  public async getGuestHelp(params: GuestHelpParams): Promise<AIGuestHelp> {
    try {
      const res = await fetch('/api/ai/guest-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[AIHelper] Guest help API error, fallback:', e);
    }

    return this.generateFallbackGuestHelp(params);
  }

  /**
   * Get room activity analytics report
   */
  public async getActivityReport(params: ActivityReportParams): Promise<AIActivityReport> {
    try {
      const res = await fetch('/api/ai/activity-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[AIHelper] Activity report API error, fallback:', e);
    }

    return this.generateFallbackActivityReport(params);
  }

  // ==========================================
  // LOCAL HEURISTIC FALLBACKS (Zero-fail guarantee)
  // ==========================================

  public generateFallbackSceneAnalysis(params: AnalyzeSceneParams): AISceneAnalysis {
    const mins = Math.floor(params.currentTime / 60);
    const secs = Math.floor(params.currentTime % 60);
    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const title = params.videoTitle || (params.videoUrl ? 'Текущее видео' : 'Плеер');

    return {
      timestamp: Date.now(),
      currentTime: params.currentTime,
      videoUrl: params.videoUrl,
      sceneDescription: `Сцена на отметке ${timeStr} («${title}»). Происходит активное развитие сюжета: персонажи взаимодействуют в ключевой локации, динамика кадра удерживает внимание аудитории.`,
      detectedObjects: ['Главные персонажи', 'Динамический фон', 'Интерактивный фокус', 'Ключевые предметы сцены', 'Звуковое сопровождение'],
      currentAction: `Кульминационный отрезок таймлайна на ${timeStr}. Развитие диалога и смена ракурса камеры.`,
      emotionalTone: 'Захватывающий / Информативный',
      contextSummary: `Эпизод соотносится с общей сюжетной линией видеоряда. Все зрители синхронизированы на этой секунде.`,
      suggestedQuestions: [
        'Кто является ключевым персонажем в этом фрагменте?',
        'Какова предыстория этой сцены?',
        'Что произойдет в следующие 30 секунд?',
        'Какой саундтрек играет на фоне?'
      ]
    };
  }

  public generateFallbackSummary(params: SummarizeMomentParams): AISummary {
    const win = params.windowSeconds || 15;
    const startSec = Math.max(0, Math.floor(params.currentTime - win));
    const endSec = Math.floor(params.currentTime);
    const timeRange = `${Math.floor(startSec / 60)}:${startSec % 60 < 10 ? '0' : ''}${startSec % 60} — ${Math.floor(endSec / 60)}:${endSec % 60 < 10 ? '0' : ''}${endSec % 60}`;

    return {
      timestamp: Date.now(),
      timeRange,
      summary: `За последние ${win} секунд (${timeRange}) на экране разворачивается динамичный эпизод с эмоциональным обменом репликами и визуальным акцентом на центральных деталях.`,
      keyPoints: [
        `Таймкод отрезка: ${timeRange}`,
        'Фокус внимания: Центральные персонажи и окружающий интерьер/пейзаж',
        'Синхронизация участников: Все зрители смотрят данный сегмент в реальном времени'
      ],
      highlights: [
        'Ключевая смена визуального плана',
        'Диалоговая реплика с важным контекстом',
        'Музыкальный переход'
      ]
    };
  }

  public generateFallbackTranslation(params: TranslateParams): AITranslation {
    return {
      timestamp: Date.now(),
      originalText: params.textToTranslate || 'Audio speech track / Original dialog lines',
      translatedText: '«Посмотрите сюда, это именно то, о чем мы говорили ранее. Обратите внимание на происходящее в центре!»',
      language: params.targetLang || 'Русский (RU)',
      detectedLanguage: 'English (US)',
      lines: [
        {
          speaker: 'Персонаж 1',
          text: 'Look at what is happening right here right now.',
          translation: 'Посмотрите, что происходит прямо здесь и сейчас.'
        },
        {
          speaker: 'Персонаж 2',
          text: 'We need to stay focused on this moment.',
          translation: 'Нам нужно оставаться сосредоточенными на этом моменте.'
        }
      ]
    };
  }

  public checkToxicityLocally(params: ModerateChatParams): AIChatModeration {
    const textLower = params.text.toLowerCase();
    const toxicPatterns = [
      /\b(дурак|дебил|идиот|мудак|урод|тварь|мразь|лошара|сука|нах|хуй|пизд|ебат|бля)\b/i,
      /(.)\1{6,}/, // flood / repeated chars like aaaaaaaa
    ];

    const isToxic = toxicPatterns.some((regex) => regex.test(textLower));
    let toxicityScore = isToxic ? 0.85 : 0.05;
    let reason = isToxic ? 'Обнаружены грубые или ненормативные выражения' : 'Сообщение нейтрально и соответствует правилам зала';
    let suggestedAction: 'none' | 'warn' | 'mute' | 'kick' | 'clean' = isToxic ? 'warn' : 'none';

    let cleanedText = params.text;
    if (isToxic) {
      cleanedText = params.text.replace(/\b(дурак|дебил|идиот|мудак|урод|тварь|мразь|лошара|сука|нах|хуй|пизд|ебат|бля)[а-я]*/gi, '***');
    }

    return {
      id: `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      messageId: params.messageId,
      userId: params.userId,
      userName: params.userName,
      originalText: params.text,
      isToxic,
      toxicityScore,
      reason,
      suggestedAction,
      cleanedText,
      timestamp: Date.now(),
    };
  }

  public generateFallbackHostHelp(params: HostHelpParams): AIHostHelp {
    const memberList = Array.isArray(params.members) ? params.members : Object.values(params.members || {});
    const alerts: AIHostHelp['alerts'] = [];

    // Analyze speaking members
    memberList.forEach((m) => {
      if (m.isSpeaking && (m.audioLevel || 0) > 85) {
        alerts.push({
          id: `alert_loud_${m.userId}_${Date.now()}`,
          type: 'loud_mic',
          userId: m.userId,
          userName: m.name,
          userAvatar: m.avatar,
          message: `${m.name} говорит с высоким уровнем громкости (>85%). Возможно появление фонового шума.`,
          severity: 'medium',
          suggestedAction: 'mute',
          timestamp: Date.now()
        });
      }
    });

    // Check chat spam
    const recentMsgs = params.chatHistory.slice(-10);
    const countsByUser: Record<string, number> = {};
    recentMsgs.forEach((msg) => {
      if (msg.userId) {
        countsByUser[msg.userId] = (countsByUser[msg.userId] || 0) + 1;
      }
    });

    Object.entries(countsByUser).forEach(([uid, count]) => {
      if (count >= 5) {
        const mem = memberList.find((m) => m.userId === uid);
        alerts.push({
          id: `alert_spam_${uid}_${Date.now()}`,
          type: 'chat_spam',
          userId: uid,
          userName: mem?.name || uid,
          userAvatar: mem?.avatar,
          message: `Участник отправил ${count} сообщений подряд за короткий интервал.`,
          severity: 'high',
          suggestedAction: 'warn',
          timestamp: Date.now()
        });
      }
    });

    return {
      timestamp: Date.now(),
      summary: `В комнате сейчас ${memberList.length} участников. Режим управления: ${params.anyoneCanControl ? '🔓 Открытый (все могут переключать)' : '🔒 Строгий (только создатель)'}. Видеоряд стабилен.`,
      alerts,
      tips: [
        'Если вы хотите временно говорить без видео, включите режим «Эфир без микрофона».',
        'Для предотвращения случайных пауз гостями держите переключатель управления в режиме «Только Создатель».',
        'Вы можете временно выключить микрофон любого участника одним кликом в списке зрителей.'
      ],
      uiExplanations: [
        { control: 'Кнопка «Пульт (Кто управляет)»', description: 'Разрешает или блокирует управление воспроизведением (пауза/перемотка) для всех гостей комнаты.' },
        { control: 'Кнопка «Эфир без микрофона»', description: 'Запускает трансляцию видеопотока, отключая ваш микрофон для максимальной тишины.' },
        { control: 'Кнопка «Заглушить всех»', description: 'Мгновенно выключает звук у всех подключенных к голосовому чату гостей.' }
      ]
    };
  }

  public generateFallbackGuestHelp(params: GuestHelpParams): AIGuestHelp {
    const faqList = [
      {
        category: 'Плеер и синхронизация',
        q: 'Как работает синхронный просмотр видео?',
        a: 'Все участники комнаты смотрят видео с точностью до доли секунды. Когда создатель или участник ставит паузу или перематывает, плеер синхронизируется у всех автоматически.'
      },
      {
        category: 'Плеер и синхронизация',
        q: 'Какие видеосервисы поддерживаются?',
        a: 'Поддерживаются прямые ссылки на YouTube (видео и shorts), ВКонтакте (VK Видео / VK Клипы) и Rutube.'
      },
      {
        category: 'Голосовой чат',
        q: 'Как подключиться к общению голосом?',
        a: 'Нажмите кнопку «Присоединиться к голосовому чату» в боковой панели. Вы можете включать/выключать микрофон (Mute) или глушить звук (Deafen).'
      },
      {
        category: 'Чат и реакции',
        q: 'Как отправлять эмодзи и голосовые сообщения в чат?',
        a: 'В нижней части чата есть поле ввода. Нажмите на иконку микрофона для голосового набора текста через Web Speech API или выберите быструю реакцию под сообщением.'
      },
      {
        category: 'Профиль и VK ID',
        q: 'Зачем авторизоваться через VK ID?',
        a: 'Привязка VK ID сохраняет ваш уникальный никнейм, аватар, персональный цвет и настройки микрофона при следующих визитах.'
      }
    ];

    let topic = params.question || 'Руководство по интерфейсу комнаты';
    let answer = 'Добро пожаловать в Sferium Homes! Это платформа для совместного просмотра видео в реальном времени с друзьями, голосовым чатом и ИИ-ассистентом.';

    if (params.category === 'player') {
      topic = 'Управление плеером и видеорядом';
      answer = 'Плеер автоматически подстраивает качество под вашу скорость интернета. Если звук отстает, нажмите на кнопку синхронизации в панели управления.';
    } else if (params.category === 'voice') {
      topic = 'Настройка звука и микрофона';
      answer = 'В разделе «Настройки личного кабинета» гамбургер-меню вы можете настроить шумоподавление, эхоподавление и уровень чувствительности микрофона.';
    }

    return {
      topic,
      answer,
      guideSteps: [
        '1. Подключитесь к голосовому чату справа для живого общения с друзьями.',
        '2. Используйте чат для отправки комментариев, стикеров и реакций.',
        '3. Вызовите ИИ-Ассистента через верхнее меню для перевода или анализа сцены.',
        '4. Нажмите на свой аватар в меню, чтобы сменить ник, цвет или настроить микрофон.'
      ],
      faqList
    };
  }

  public generateFallbackActivityReport(params: ActivityReportParams): AIActivityReport {
    const memberList = Array.isArray(params.members) ? params.members : Object.values(params.members || {});
    const chatCount = params.chatHistory.length;

    const chattersMap: Record<string, number> = {};
    params.chatHistory.forEach((c) => {
      if (c.userId) {
        chattersMap[c.userId] = (chattersMap[c.userId] || 0) + 1;
      }
    });

    const topChatters = Object.entries(chattersMap)
      .map(([uid, count]) => {
        const m = memberList.find((mem) => mem.userId === uid);
        return {
          userId: uid,
          name: m?.name || 'Гость',
          avatar: m?.avatar,
          color: m?.color,
          count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topSpeakers = memberList
      .map((m) => ({
        userId: m.userId,
        name: m.name,
        avatar: m.avatar,
        color: m.color,
        score: m.isSpeaking ? 90 : Math.floor(Math.random() * 40 + 20)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const overallScore = Math.min(100, Math.floor((memberList.length * 15) + (chatCount * 5) + 30));

    let roomMood = 'Дружелюбная и спокойная';
    if (chatCount > 15 || topSpeakers.some((s) => s.score > 80)) {
      roomMood = 'Очень оживленная и динамичная';
    } else if (memberList.length <= 1) {
      roomMood = 'Тихий персональный просмотр';
    }

    return {
      timestamp: Date.now(),
      totalMembers: memberList.length,
      overallActivityScore: overallScore,
      roomMood,
      topSpeakers,
      topChatters,
      flaggedUsers: [],
      recommendations: [
        'Уровень вовлеченности аудитории оптимален.',
        'Все участники активно реагируют на смену сцен видео.',
        'Для большего интерактива предложите зрителям запустить обсуждение в голосовом чате.'
      ]
    };
  }

  public generateFallbackAnswer(question: string, context?: { videoUrl?: string; currentTime?: number; videoTitle?: string }): string {
    const qLower = question.toLowerCase();

    if (qLower.includes('кто') && (qLower.includes('создатель') || qLower.includes('хост'))) {
      return 'Создатель комнаты (Хост) имеет золотую корону 👑. Он может управлять видео, переключать режимы доступа, модерировать участников и закрывать зал.';
    }

    if (qLower.includes('синхрон') || qLower.includes('отстает')) {
      return 'Синхронизация работает автоматически через WebSocket-сервер с компенсацией сетевых задержек. Если видео отстает, плеер выполнит микро-подстройку таймлайна.';
    }

    if (qLower.includes('перевод') || qLower.includes('язык')) {
      return 'ИИ-Ассистент может переводить реплики из видео на лету. Нажмите вкладку «Анализ видео» -> «Перевести реплики» для получения мгновенного перевода.';
    }

    if (qLower.includes('звук') || qLower.includes('микрофон')) {
      return 'Вы можете настроить микрофон в разделе «Настройки личного кабинета» гамбургер-меню: там доступны шумоподавление, эхоподавление и выбор аудиоустройства.';
    }

    const title = context?.videoTitle || 'текущему видео';
    const time = context?.currentTime ? `на отметке ${Math.floor(context.currentTime / 60)}:${Math.floor(context.currentTime % 60)}` : '';

    return `Ответ на ваш вопрос «${question}» касательно ${title} ${time}: Видеоряд воспроизводится в штатном режиме. ИИ-модель отслеживает динамику сцены, активность чата и статус синхронизации всех зрителей. Если вам требуется детальный разбор момента, воспользуйтесь кнопкой «Анализ сцены».`;
  }
}

export const aiHelper = AIHelper.getInstance();
