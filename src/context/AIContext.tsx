import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  AISceneAnalysis,
  AISummary,
  AITranslation,
  AIChatModeration,
  AIModerationAlert,
  AIHostHelp,
  AIGuestHelp,
  AIActivityReport,
  AIMessage,
  RoomState,
  Member,
  ChatMessage
} from '../types';
import { aiHelper } from '../modules/AIHelper';
import { notificationManager } from '../utils/notifications';
import { soundManager } from '../utils/soundNotifications';

export interface AIContextType {
  // State
  isLoading: boolean;
  activeFeature: string | null;
  sceneAnalysis: AISceneAnalysis | null;
  momentSummary: AISummary | null;
  translation: AITranslation | null;
  moderationAlerts: AIModerationAlert[];
  moderationLog: AIChatModeration[];
  hostHelp: AIHostHelp | null;
  guestHelp: AIGuestHelp | null;
  activityReport: AIActivityReport | null;
  aiChatHistory: AIMessage[];
  isAutoModerationEnabled: boolean;

  // Actions
  analyzeScene: (params?: { prompt?: string }) => Promise<AISceneAnalysis | null>;
  summarizeMoment: (windowSeconds?: number) => Promise<AISummary | null>;
  translateLines: (text?: string, targetLang?: string) => Promise<AITranslation | null>;
  askAI: (question: string) => Promise<string>;
  requestHostHelp: () => Promise<AIHostHelp | null>;
  requestGuestHelp: (params?: { question?: string; category?: 'player' | 'voice' | 'chat' | 'general' }) => Promise<AIGuestHelp | null>;
  requestActivityReport: () => Promise<AIActivityReport | null>;
  moderateMessage: (text: string, userId: string, userName: string, messageId: string) => Promise<AIChatModeration>;
  dismissAlert: (alertId: string) => void;
  toggleAutoModeration: () => void;
  clearAIChat: () => void;
  handleIncomingAIWebSocketMessage: (msg: any) => void;
}

const AIContext = createContext<AIContextType | null>(null);

export interface AIProviderProps {
  children: React.ReactNode;
  roomId?: string;
  roomState?: RoomState | null;
  currentUserId?: string;
  isHost?: boolean;
  sendWebSocketMessage?: (msg: any) => void;
}

export const AIProvider: React.FC<AIProviderProps> = ({
  children,
  roomId = '',
  roomState,
  currentUserId = '',
  isHost = false,
  sendWebSocketMessage,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [sceneAnalysis, setSceneAnalysis] = useState<AISceneAnalysis | null>(null);
  const [momentSummary, setMomentSummary] = useState<AISummary | null>(null);
  const [translation, setTranslation] = useState<AITranslation | null>(null);
  const [moderationAlerts, setModerationAlerts] = useState<AIModerationAlert[]>([]);
  const [moderationLog, setModerationLog] = useState<AIChatModeration[]>([]);
  const [hostHelp, setHostHelp] = useState<AIHostHelp | null>(null);
  const [guestHelp, setGuestHelp] = useState<AIGuestHelp | null>(null);
  const [activityReport, setActivityReport] = useState<AIActivityReport | null>(null);
  const [isAutoModerationEnabled, setIsAutoModerationEnabled] = useState(true);

  const [aiChatHistory, setAiChatHistory] = useState<AIMessage[]>([
    {
      id: 'welcome_ai_msg',
      role: 'assistant',
      text: 'Привет! Я ИИ-Ассистент Sferium Homes 🤖. Я умею анализировать кадры видео, делать краткие резюме, переводить диалоги, помогать с настройками кинозала и модерировать чат. Чем я могу помочь?',
      timestamp: Date.now(),
      type: 'chat'
    }
  ]);

  const currentTime = roomState?.currentTime || 0;
  const videoUrl = roomState?.videoUrl || '';
  const videoTitle = roomState?.currentVideoTitle || '';
  const members = useMemo(() => roomState?.members || {}, [roomState?.members]);
  const chatHistory = useMemo(() => roomState?.chatHistory || [], [roomState?.chatHistory]);

  // Handle WebSocket messages from server for AI events
  const handleIncomingAIWebSocketMessage = useCallback((msg: any) => {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'ai:sceneAnalysis':
        if (msg.analysis) {
          setSceneAnalysis(msg.analysis);
          notificationManager.pushNotification({
            type: 'system',
            title: '🎬 Анализ сцены ИИ',
            message: msg.analysis.sceneDescription.slice(0, 100) + '...',
            category: 'general',
          });
        }
        break;

      case 'ai:summary':
        if (msg.summary) {
          setMomentSummary(msg.summary);
          notificationManager.pushNotification({
            type: 'system',
            title: '⏱️ Резюме момента',
            message: msg.summary.summary.slice(0, 100) + '...',
            category: 'general',
          });
        }
        break;

      case 'ai:translation':
        if (msg.translation) {
          setTranslation(msg.translation);
          notificationManager.pushNotification({
            type: 'system',
            title: '🌐 Перевод реплик',
            message: msg.translation.translatedText.slice(0, 80) + '...',
            category: 'general',
          });
        }
        break;

      case 'ai:moderationWarning':
        if (msg.moderation) {
          const mod = msg.moderation as AIChatModeration;
          setModerationLog((prev) => [mod, ...prev.slice(0, 49)]);

          const alert: AIModerationAlert = {
            id: `alert_mod_${Date.now()}`,
            type: 'toxic_behavior',
            userId: mod.userId,
            userName: mod.userName,
            userAvatar: mod.userAvatar,
            message: `ИИ обнаружил ненормативное сообщение от ${mod.userName}: "${mod.originalText}"`,
            severity: 'high',
            suggestedAction: mod.suggestedAction === 'none' ? 'warn' : mod.suggestedAction as any,
            timestamp: Date.now()
          };

          setModerationAlerts((prev) => [alert, ...prev.slice(0, 19)]);
          soundManager.playKickOrMute();

          notificationManager.pushNotification({
            type: 'chat',
            title: '⚠️ Предупреждение ИИ-модератора',
            message: `Участник ${mod.userName}: ${mod.reason}`,
            category: 'host',
          });
        }
        break;

      case 'ai:hostHelp':
        if (msg.hostHelp) {
          setHostHelp(msg.hostHelp);
        }
        break;

      case 'ai:guestHelp':
        if (msg.guestHelp) {
          setGuestHelp(msg.guestHelp);
        }
        break;

      case 'ai:activityReport':
        if (msg.activityReport) {
          setActivityReport(msg.activityReport);
        }
        break;

      default:
        break;
    }
  }, []);

  // 1. Analyze scene
  const analyzeScene = useCallback(async (params?: { prompt?: string }) => {
    setIsLoading(true);
    setActiveFeature('scene');
    try {
      if (sendWebSocketMessage) {
        sendWebSocketMessage({
          type: 'ai:sceneAnalysis',
          roomId,
          currentTime,
          videoUrl,
          videoTitle,
          prompt: params?.prompt
        });
      }

      const result = await aiHelper.analyzeCurrentScene({
        roomId,
        currentTime,
        videoUrl,
        videoTitle,
        prompt: params?.prompt
      });

      setSceneAnalysis(result);
      soundManager.playAiSuccess();
      return result;
    } catch (e) {
      console.error('[AIContext] Error analyzing scene:', e);
      return null;
    } finally {
      setIsLoading(false);
      setActiveFeature(null);
    }
  }, [roomId, currentTime, videoUrl, videoTitle, sendWebSocketMessage]);

  // 2. Summarize moment
  const summarizeMoment = useCallback(async (windowSeconds = 15) => {
    setIsLoading(true);
    setActiveFeature('summary');
    try {
      if (sendWebSocketMessage) {
        sendWebSocketMessage({
          type: 'ai:summary',
          roomId,
          currentTime,
          videoUrl,
          videoTitle,
          windowSeconds
        });
      }

      const result = await aiHelper.summarizeMoment({
        roomId,
        currentTime,
        videoUrl,
        videoTitle,
        windowSeconds
      });

      setMomentSummary(result);
      soundManager.playAiSuccess();
      return result;
    } catch (e) {
      console.error('[AIContext] Error summarizing moment:', e);
      return null;
    } finally {
      setIsLoading(false);
      setActiveFeature(null);
    }
  }, [roomId, currentTime, videoUrl, videoTitle, sendWebSocketMessage]);

  // 3. Translate lines
  const translateLines = useCallback(async (text?: string, targetLang = 'Русский') => {
    setIsLoading(true);
    setActiveFeature('translate');
    try {
      if (sendWebSocketMessage) {
        sendWebSocketMessage({
          type: 'ai:translation',
          roomId,
          currentTime,
          textToTranslate: text,
          targetLang
        });
      }

      const result = await aiHelper.translateLines({
        roomId,
        currentTime,
        videoUrl,
        textToTranslate: text,
        targetLang
      });

      setTranslation(result);
      soundManager.playAiSuccess();
      return result;
    } catch (e) {
      console.error('[AIContext] Error translating lines:', e);
      return null;
    } finally {
      setIsLoading(false);
      setActiveFeature(null);
    }
  }, [roomId, currentTime, videoUrl, sendWebSocketMessage]);

  // 4. Ask interactive question
  const askAI = useCallback(async (question: string) => {
    if (!question.trim()) return '';

    const userMsg: AIMessage = {
      id: `ai_user_${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: Date.now(),
      type: 'chat'
    };

    setAiChatHistory((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const answer = await aiHelper.askAI(question, {
        videoUrl,
        currentTime,
        videoTitle
      });

      const assistantMsg: AIMessage = {
        id: `ai_resp_${Date.now()}`,
        role: 'assistant',
        text: answer,
        timestamp: Date.now(),
        type: 'chat'
      };

      setAiChatHistory((prev) => [...prev, assistantMsg]);
      soundManager.playAiSuccess();
      return answer;
    } catch (e) {
      console.error('[AIContext] Error in askAI:', e);
      const fallback = 'Извините, не удалось обработать запрос. Попробуйте еще раз.';
      setAiChatHistory((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: 'assistant',
          text: fallback,
          timestamp: Date.now(),
          type: 'chat'
        }
      ]);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [videoUrl, currentTime, videoTitle]);

  // 5. Host Help
  const requestHostHelp = useCallback(async () => {
    setIsLoading(true);
    setActiveFeature('hostHelp');
    try {
      if (sendWebSocketMessage) {
        sendWebSocketMessage({
          type: 'ai:hostHelp',
          roomId,
          anyoneCanControl: Boolean(roomState?.anyoneCanControl)
        });
      }

      const result = await aiHelper.getHostHelp({
        roomId,
        members,
        chatHistory,
        anyoneCanControl: Boolean(roomState?.anyoneCanControl),
        videoUrl
      });

      setHostHelp(result);
      return result;
    } catch (e) {
      console.error('[AIContext] Error requesting host help:', e);
      return null;
    } finally {
      setIsLoading(false);
      setActiveFeature(null);
    }
  }, [roomId, members, chatHistory, roomState?.anyoneCanControl, videoUrl, sendWebSocketMessage]);

  // 6. Guest Help
  const requestGuestHelp = useCallback(async (params?: { question?: string; category?: 'player' | 'voice' | 'chat' | 'general' }) => {
    setIsLoading(true);
    setActiveFeature('guestHelp');
    try {
      if (sendWebSocketMessage) {
        sendWebSocketMessage({
          type: 'ai:guestHelp',
          roomId,
          question: params?.question,
          category: params?.category
        });
      }

      const result = await aiHelper.getGuestHelp(params || {});
      setGuestHelp(result);
      return result;
    } catch (e) {
      console.error('[AIContext] Error requesting guest help:', e);
      return null;
    } finally {
      setIsLoading(false);
      setActiveFeature(null);
    }
  }, [roomId, sendWebSocketMessage]);

  // 7. Activity Report
  const requestActivityReport = useCallback(async () => {
    setIsLoading(true);
    setActiveFeature('activity');
    try {
      if (sendWebSocketMessage) {
        sendWebSocketMessage({
          type: 'ai:activityReport',
          roomId
        });
      }

      const result = await aiHelper.getActivityReport({
        roomId,
        members,
        chatHistory
      });

      setActivityReport(result);
      return result;
    } catch (e) {
      console.error('[AIContext] Error requesting activity report:', e);
      return null;
    } finally {
      setIsLoading(false);
      setActiveFeature(null);
    }
  }, [roomId, members, chatHistory, sendWebSocketMessage]);

  // 8. Moderate message
  const moderateMessage = useCallback(async (text: string, userId: string, userName: string, messageId: string) => {
    const result = await aiHelper.moderateChatMessage({
      text,
      userId,
      userName,
      messageId
    });

    if (result.isToxic) {
      setModerationLog((prev) => [result, ...prev.slice(0, 49)]);
      if (isHost) {
        setModerationAlerts((prev) => [
          {
            id: `alert_${Date.now()}`,
            type: 'toxic_behavior',
            userId,
            userName,
            message: `Токсичное сообщение: "${text}"`,
            severity: 'high',
            suggestedAction: result.suggestedAction === 'none' ? 'warn' : result.suggestedAction as any,
            timestamp: Date.now()
          },
          ...prev.slice(0, 19)
        ]);
      }
    }

    return result;
  }, [isHost]);

  const dismissAlert = useCallback((alertId: string) => {
    setModerationAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const toggleAutoModeration = useCallback(() => {
    setIsAutoModerationEnabled((prev) => !prev);
  }, []);

  const clearAIChat = useCallback(() => {
    setAiChatHistory([
      {
        id: `cleared_${Date.now()}`,
        role: 'assistant',
        text: 'История диалога очищена. Чем я могу помочь?',
        timestamp: Date.now(),
        type: 'chat'
      }
    ]);
  }, []);

  return (
    <AIContext.Provider
      value={{
        isLoading,
        activeFeature,
        sceneAnalysis,
        momentSummary,
        translation,
        moderationAlerts,
        moderationLog,
        hostHelp,
        guestHelp,
        activityReport,
        aiChatHistory,
        isAutoModerationEnabled,
        analyzeScene,
        summarizeMoment,
        translateLines,
        askAI,
        requestHostHelp,
        requestGuestHelp,
        requestActivityReport,
        moderateMessage,
        dismissAlert,
        toggleAutoModeration,
        clearAIChat,
        handleIncomingAIWebSocketMessage
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
