import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Lock, 
  Users, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Poll, PollOption } from '../types';
import { soundManager } from '../utils/soundNotifications';

interface PollsProps {
  polls: Poll[];
  currentUserId: string;
  isHost: boolean;
  onCreatePoll: (question: string, options: string[], durationSeconds?: number) => void;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
}

export const Polls: React.FC<PollsProps> = ({
  polls,
  currentUserId,
  isHost,
  onCreatePoll,
  onVote,
  onClosePoll,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['Да', 'Нет']);
  const [duration, setDuration] = useState<number>(60);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, `Вариант ${options.length + 1}`]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const next = [...options];
    next[index] = val;
    setOptions(next);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) return;

    onCreatePoll(question.trim(), validOptions, duration > 0 ? duration : undefined);
    setQuestion('');
    setOptions(['Да', 'Нет']);
    setIsCreating(false);
    soundManager.playAiSuccess();
  };

  const activePolls = polls.filter((p) => !p.isClosed);
  const closedPolls = polls.filter((p) => p.isClosed);

  return (
    <div id="polls-panel-container" className="space-y-6 text-neutral-200">
      {/* Header with Create Button for Host */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Голосования и Опросы</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Принимайте совместные решения по фильму, перерывам и выбору сцен
          </p>
        </div>

        {isHost && !isCreating && (
          <button
            id="btn-create-poll-toggle"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Создать опрос</span>
          </button>
        )}
      </div>

      {/* Poll Creation Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmitCreate}
            className="bg-neutral-900/90 border border-indigo-500/30 rounded-2xl p-4 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-sm font-bold text-indigo-300">Новый опрос</span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Отмена
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Вопрос опроса
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Например: Смотрим до конца или делаем перерыв на чай?"
                className="w-full px-3 py-2 bg-neutral-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-400">
                Варианты ответа
              </label>
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Вариант ${index + 1}`}
                    className="flex-1 px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-neutral-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить вариант</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Длительность
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={30}>30 секунд</option>
                <option value={60}>1 минута</option>
                <option value={180}>3 минуты</option>
                <option value={0}>Без таймера</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
            >
              Запустить голосование
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Active Polls List */}
      <div className="space-y-4">
        {activePolls.length === 0 && !isCreating && (
          <div className="text-center py-8 px-4 bg-neutral-900/40 rounded-2xl border border-white/5">
            <BarChart3 className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">Сейчас нет активных голосований</p>
            <p className="text-xs text-neutral-500 mt-1">
              {isHost ? 'Создайте опрос, чтобы узнать мнение зрителей' : 'Ожидайте запуска опроса создателем комнаты'}
            </p>
          </div>
        )}

        {activePolls.map((poll) => {
          const hasVoted = poll.options.some((o) => o.votes.includes(currentUserId));
          const totalVotes = Math.max(1, poll.totalVotes || poll.options.reduce((s, o) => s + o.votes.length, 0));

          return (
            <div
              key={poll.id}
              className="bg-neutral-900/90 border border-indigo-500/30 rounded-2xl p-4 space-y-3 shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    Активно
                  </span>
                  <h3 className="text-base font-bold text-white mt-1.5">{poll.question}</h3>
                </div>

                {isHost && (
                  <button
                    onClick={() => onClosePoll(poll.id)}
                    className="text-xs text-neutral-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-neutral-800"
                    title="Завершить опрос"
                  >
                    Завершить
                  </button>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2 pt-1">
                {poll.options.map((opt) => {
                  const isMyVote = opt.votes.includes(currentUserId);
                  const count = opt.votes.length;
                  const percent = Math.round((count / totalVotes) * 100);

                  return (
                    <button
                      key={opt.id}
                      onClick={() => onVote(poll.id, opt.id)}
                      className={`relative w-full p-2.5 rounded-xl border text-left transition-all overflow-hidden cursor-pointer ${
                        isMyVote
                          ? 'border-indigo-500 bg-indigo-950/30 text-white'
                          : 'border-white/10 bg-neutral-800/60 hover:bg-neutral-800 text-neutral-200'
                      }`}
                    >
                      {/* Vote percentage bar fill */}
                      <div
                        className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                          isMyVote ? 'bg-indigo-600/30' : 'bg-white/5'
                        }`}
                        style={{ width: `${percent}%` }}
                      />

                      <div className="relative flex items-center justify-between text-xs font-medium z-10">
                        <div className="flex items-center gap-2">
                          {isMyVote && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                          <span>{opt.text}</span>
                        </div>
                        <span className="font-mono text-neutral-400">
                          {percent}% ({count})
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-white/5">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Всего голосов: {poll.totalVotes}
                </span>
                <span>Создал: {poll.createdByName}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed Polls Archive */}
      {closedPolls.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Завершённые голосования
          </h4>
          {closedPolls.slice(0, 3).map((poll) => (
            <div key={poll.id} className="bg-neutral-900/40 border border-white/5 rounded-xl p-3 text-xs opacity-75">
              <div className="font-bold text-neutral-300 mb-1">{poll.question}</div>
              <div className="space-y-1">
                {poll.options.map((opt) => (
                  <div key={opt.id} className="flex justify-between text-neutral-400">
                    <span>{opt.text}</span>
                    <span>{opt.votes.length} голосов</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
