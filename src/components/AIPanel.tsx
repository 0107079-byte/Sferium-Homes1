import React, { useState } from 'react';
import { useAI } from '../context/AIContext';
import {
  Sparkles,
  Play,
  Languages,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Crown,
  HelpCircle,
  BarChart2,
  MessageSquare,
  Volume2,
  VolumeX,
  UserX,
  AlertTriangle,
  Send,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  Flame,
  Radio,
  Eye,
  RefreshCw
} from 'lucide-react';
import { Member } from '../types';

export type AIPanelTab = 'video' | 'moderation' | 'host' | 'guest' | 'activity' | 'chat';

export interface AIPanelProps {
  roomId?: string;
  isHost: boolean;
  members: Record<string, Member> | Member[];
  currentUserId: string;
  currentTime?: number;
  videoTitle?: string;
  videoUrl?: string;
  onMuteUser?: (userId: string, isMuted: boolean) => void;
  onKickUser?: (userId: string, reason?: string) => void;
  onTransferHost?: (userId: string) => void;
  onClose?: () => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  roomId = '',
  isHost,
  members,
  currentUserId,
  currentTime = 0,
  videoTitle = '',
  videoUrl = '',
  onMuteUser,
  onKickUser,
  onTransferHost,
  onClose,
}) => {
  const {
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
    dismissAlert,
    toggleAutoModeration,
    clearAIChat,
  } = useAI();

  const [activeTab, setActiveTab] = useState<AIPanelTab>('video');
  const [chatInput, setChatInput] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('all');
  const [searchFaq, setSearchFaq] = useState('');

  const memberList: Member[] = Array.isArray(members)
    ? members
    : Object.values(members || {});

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;
    const text = chatInput.trim();
    setChatInput('');
    await askAI(text);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* Top AI Header */}
      <div className="p-4 border-b border-zinc-800 bg-gradient-to-r from-indigo-950/80 via-purple-950/80 to-zinc-900 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-purple-950/50 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-purple-300">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-black text-white tracking-wide">
                ИИ-Ассистент Sferium
              </h2>
              <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                Gemini 3.7
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {currentTime > 0 ? `Кадр ${formatTime(currentTime)}` : 'Готов к работе'} • {roomId ? `Зал #${roomId}` : 'Лобби'}
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Думаю...</span>
          </div>
        )}
      </div>

      {/* Tab Navigation Ribbon */}
      <div className="p-2 border-b border-zinc-850 bg-zinc-900/60 overflow-x-auto custom-scrollbar flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'video'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          Анализ видео
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('moderation');
          }}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'moderation'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Модерация
          {moderationAlerts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">
              {moderationAlerts.length}
            </span>
          )}
        </button>

        {isHost && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('host');
              requestHostHelp();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'host'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400/80 hover:text-amber-200 hover:bg-zinc-800/60'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            Хосту
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setActiveTab('guest');
            requestGuestHelp();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'guest'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Гостю (FAQ)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('activity');
            requestActivityReport();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          Активность
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-pink-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Вопросы ИИ
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* ========================================================================= */}
        {/* TAB 1: VIDEO ANALYSIS                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'video' && (
          <div className="space-y-4">
            {/* Action Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                id="btn-ai-analyze-scene"
                onClick={() => analyzeScene()}
                disabled={isLoading}
                className="group p-3 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 hover:border-indigo-400 text-left transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg group-hover:scale-110 transition-transform">
                    <Eye className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-mono text-indigo-300">
                    {formatTime(currentTime)}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-200">
                    Что происходит?
                  </h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Анализ текущего кадра и сцены
                  </p>
                </div>
              </button>

              <button
                type="button"
                id="btn-ai-summarize"
                onClick={() => summarizeMoment(15)}
                disabled={isLoading}
                className="group p-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 hover:border-purple-400 text-left transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 bg-purple-500/20 text-purple-300 rounded-lg group-hover:scale-110 transition-transform">
                    <Clock className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-mono text-purple-300">15 сек</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-purple-200">
                    Краткое резюме
                  </h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Сводка последних секунд
                  </p>
                </div>
              </button>

              <button
                type="button"
                id="btn-ai-translate"
                onClick={() => translateLines()}
                disabled={isLoading}
                className="group p-3 rounded-xl bg-pink-950/40 hover:bg-pink-900/60 border border-pink-500/30 hover:border-pink-400 text-left transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 bg-pink-500/20 text-pink-300 rounded-lg group-hover:scale-110 transition-transform">
                    <Languages className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-mono text-pink-300">RU</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-pink-200">
                    Перевести реплики
                  </h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Перевод речи и субтитров
                  </p>
                </div>
              </button>
            </div>

            {/* Scene Analysis Card */}
            {sceneAnalysis && (
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-indigo-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-indigo-500/20 text-indigo-300 rounded-md">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Анализ кадра ({formatTime(sceneAnalysis.currentTime)})
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium">
                    {sceneAnalysis.emotionalTone}
                  </span>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed">
                  {sceneAnalysis.sceneDescription}
                </p>

                {/* Detected Objects Tags */}
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Объекты и фокус кадра:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {sceneAnalysis.detectedObjects.map((obj, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700"
                      >
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Suggested Discussion Questions */}
                {sceneAnalysis.suggestedQuestions && sceneAnalysis.suggestedQuestions.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800">
                    <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider block mb-1.5">
                      💡 Темы для обсуждения с друзьями:
                    </span>
                    <ul className="space-y-1">
                      {sceneAnalysis.suggestedQuestions.map((q, i) => (
                        <li
                          key={i}
                          onClick={() => {
                            setActiveTab('chat');
                            askAI(q);
                          }}
                          className="text-[11px] text-zinc-300 hover:text-indigo-200 bg-zinc-950/50 hover:bg-indigo-950/30 border border-zinc-850 hover:border-indigo-500/30 p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <span>{q}</span>
                          <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Moment Summary Card */}
            {momentSummary && (
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-purple-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-purple-500/20 text-purple-300 rounded-md">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Резюме момента ({momentSummary.timeRange})
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed">
                  {momentSummary.summary}
                </p>

                <div className="space-y-1">
                  {momentSummary.keyPoints.map((pt, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Translation Card */}
            {translation && (
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-pink-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-pink-500/20 text-pink-300 rounded-md">
                      <Languages className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Перевод диалогов ({translation.detectedLanguage} → {translation.language})
                    </h3>
                  </div>
                </div>

                <p className="text-xs font-medium text-pink-200 bg-pink-950/30 border border-pink-500/20 p-2.5 rounded-xl">
                  {translation.translatedText}
                </p>

                {translation.lines && translation.lines.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    {translation.lines.map((line, i) => (
                      <div key={i} className="text-[11px] bg-zinc-950/60 p-2 rounded-lg border border-zinc-850">
                        <span className="text-pink-400 font-bold block mb-0.5">{line.speaker || 'Персонаж'}:</span>
                        <p className="text-zinc-400 italic mb-0.5">"{line.text}"</p>
                        <p className="text-white font-medium">"{line.translation}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!sceneAnalysis && !momentSummary && !translation && (
              <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/80 text-zinc-400 space-y-2">
                <Sparkles className="w-8 h-8 text-indigo-400 mx-auto opacity-40" />
                <p className="text-xs font-bold text-zinc-200">
                  Интеллектуальный видеоанализ готов
                </p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Нажмите любую из кнопок выше для мгновенного анализа кадра, получения резюме или перевода диалогов.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CHAT MODERATION & SAFETY                                          */}
        {/* ========================================================================= */}
        {activeTab === 'moderation' && (
          <div className="space-y-4">
            {/* Moderation Controls Bar */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl border ${isAutoModerationEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                  {isAutoModerationEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    ИИ-Модератор чата
                  </h4>
                  <p className="text-[10px] text-zinc-400">
                    {isAutoModerationEnabled ? 'Активен: фильтр мата, спама и токсичности' : 'Отключен'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleAutoModeration}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isAutoModerationEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                {isAutoModerationEnabled ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
            </div>

            {/* Active Moderation Alerts */}
            {moderationAlerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Требуют внимания хоста ({moderationAlerts.length})
                </h4>

                {moderationAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{alert.userName}</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded font-mono">
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-200/80 mt-0.5">{alert.message}</p>
                    </div>

                    {isHost && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onMuteUser && (
                          <button
                            type="button"
                            onClick={() => {
                              onMuteUser(alert.userId, true);
                              dismissAlert(alert.id);
                            }}
                            className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                          >
                            <VolumeX className="w-3 h-3" />
                            Мут
                          </button>
                        )}

                        {onKickUser && (
                          <button
                            type="button"
                            onClick={() => {
                              onKickUser(alert.userId, alert.message);
                              dismissAlert(alert.id);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3 h-3" />
                            Кик
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => dismissAlert(alert.id)}
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs cursor-pointer"
                        >
                          Скрыть
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Moderation History Log */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Журнал проверок ИИ
              </h4>

              {moderationLog.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 text-xs">
                  Нарушений в чате не зафиксировано. Все сообщения соответствуют нормам.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {moderationLog.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs flex items-start justify-between"
                    >
                      <div>
                        <span className="font-bold text-zinc-200">{log.userName}:</span>{' '}
                        <span className="text-zinc-400 line-through mr-1.5">"{log.originalText}"</span>
                        <span className="text-emerald-300 font-mono">→ "{log.cleanedText}"</span>
                        <p className="text-[10px] text-amber-300 mt-1">Причина: {log.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: HOST ASSISTANT                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'host' && isHost && (
          <div className="space-y-4">
            {/* Host Overview */}
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-2">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  Интеллектуальный радар Создателя
                </h3>
              </div>
              <p className="text-xs text-amber-100/90 leading-relaxed">
                {hostHelp?.summary || `Зал #${roomId}: ${memberList.length} участников. Система мониторит качество связи, уровень шума и активность чата.`}
              </p>
            </div>

            {/* Smart Host Tips */}
            {hostHelp?.tips && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Рекомендации ИИ для текущего момента:
                </h4>
                <div className="space-y-1.5">
                  {hostHelp.tips.map((tip, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick 1-Click Host Actions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Быстрые действия хоста:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    memberList.forEach((m) => {
                      if (m.userId !== currentUserId && onMuteUser) {
                        onMuteUser(m.userId, true);
                      }
                    });
                  }}
                  className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 text-left transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">Заглушить всех гостей</span>
                    <span className="text-[10px] text-zinc-400">Выключить микрофоны в один клик</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => requestHostHelp()}
                  className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 text-left transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">Пересканировать зал</span>
                    <span className="text-[10px] text-zinc-400">Обновить активность и спам-радар</span>
                  </div>
                </button>
              </div>
            </div>

            {/* UI Button Explanations */}
            {hostHelp?.uiExplanations && (
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Справка по элементам управления:
                </h4>
                <div className="space-y-1.5">
                  {hostHelp.uiExplanations.map((exp, i) => (
                    <div key={i} className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-850 text-xs">
                      <span className="font-bold text-white block">{exp.control}</span>
                      <span className="text-zinc-400 text-[11px]">{exp.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: GUEST FAQ & GUIDE                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'guest' && (
          <div className="space-y-4">
            {/* Guide Steps */}
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                Гид по совместному просмотру
              </h3>
              <div className="space-y-1.5 pt-1">
                {guestHelp?.guideSteps?.map((step, i) => (
                  <div key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ Search */}
            <div className="space-y-2">
              <input
                type="text"
                value={searchFaq}
                onChange={(e) => setSearchFaq(e.target.value)}
                placeholder="Поиск по вопросам (синхронизация, плеер, микрофон)..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-cyan-500 focus:outline-none text-xs text-white placeholder-zinc-500"
              />

              {/* FAQ Accordion List */}
              <div className="space-y-2">
                {guestHelp?.faqList
                  ?.filter((f) => !searchFaq || f.q.toLowerCase().includes(searchFaq.toLowerCase()) || f.a.toLowerCase().includes(searchFaq.toLowerCase()))
                  .map((faq, i) => (
                    <div key={i} className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="text-cyan-400 font-mono">Q:</span> {faq.q}
                      </h4>
                      <p className="text-[11px] text-zinc-300 pl-4 border-l border-cyan-500/30">
                        {faq.a}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ROOM ACTIVITY REPORT                                              */}
        {/* ========================================================================= */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {/* Overall Activity Gauge */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-emerald-400 block">
                  Индекс активности зала
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-white">
                    {activityReport?.overallActivityScore || 75}%
                  </span>
                  <span className="text-xs text-emerald-300">
                    {activityReport?.roomMood || 'Оживленная атмосфера'}
                  </span>
                </div>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
            </div>

            {/* Top Speakers & Top Chatters Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Top Speakers */}
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  Голосовая активность
                </h4>
                <div className="space-y-1.5">
                  {activityReport?.topSpeakers.map((spk, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-zinc-950/50">
                      <span className="text-zinc-300 truncate max-w-[120px]">
                        {i + 1}. {spk.name}
                      </span>
                      <span className="text-[10px] font-mono text-indigo-300 font-bold">
                        {spk.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Chatters */}
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                  Лидеры чата
                </h4>
                <div className="space-y-1.5">
                  {activityReport?.topChatters.map((cht, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-zinc-950/50">
                      <span className="text-zinc-300 truncate max-w-[120px]">
                        {i + 1}. {cht.name}
                      </span>
                      <span className="text-[10px] font-mono text-purple-300 font-bold">
                        {cht.count} сообщ.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {activityReport?.recommendations && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  ИИ-Выводы по вовлеченности:
                </h4>
                {activityReport.recommendations.map((rec, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: CHAT WITH AI (Interactive Q&A)                                    */}
        {/* ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
              <span className="text-xs font-bold text-zinc-400">
                Задайте вопрос о видео или комнате
              </span>
              <button
                type="button"
                onClick={clearAIChat}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Очистить
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
              {aiChatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-2xl text-xs ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white ml-6'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 mr-6'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 opacity-70 text-[10px] font-mono">
                    {msg.role === 'user' ? 'Вы' : 'ИИ-Ассистент Gemini 🤖'}
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-zinc-850">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Спросите у ИИ о видео, сюжете, персонажах..."
                disabled={isLoading}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-white placeholder-zinc-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isLoading}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPanel;
