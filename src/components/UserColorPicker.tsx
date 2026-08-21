import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Pipette, Palette } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { UserStatus } from '../types';

export interface UserColorPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
  previewName?: string;
  previewAvatar?: string;
  previewStatus?: UserStatus;
  previewBio?: string;
  showPreviewCard?: boolean;
}

export const DISCORD_COLOR_PALETTES = [
  { label: 'Discord Blurple', hex: '#5865F2', desc: 'Классический стиль' },
  { label: 'Фиолетовый Неон', hex: '#9333ea', desc: 'Яркий акцент' },
  { label: 'Индиго', hex: '#6366f1', desc: 'Глубокий синий' },
  { label: 'Электрик Циан', hex: '#06b6d4', desc: 'Морская волна' },
  { label: 'Изумрудный', hex: '#10b981', desc: 'Свежий зеленый' },
  { label: 'Золотой Янтарь', hex: '#f59e0b', desc: 'Теплый закат' },
  { label: 'Коралловый', hex: '#f97316', desc: 'Огненный оранж' },
  { label: 'Рубиновый', hex: '#f43f5e', desc: 'Дерзкий красный' },
  { label: 'Фуксия Nitro', hex: '#ec4899', desc: 'Премиум стиль' },
  { label: 'Сакура', hex: '#f472b6', desc: 'Пастельно-розовый' },
  { label: 'Мятный', hex: '#14b8a6', desc: 'Бирюзовый' },
  { label: 'Графит', hex: '#71717a', desc: 'Темный минимализм' },
];

export const UserColorPicker: React.FC<UserColorPickerProps> = ({
  selectedColor,
  onChange,
  previewName = 'Никнейм',
  previewAvatar = '🍿',
  previewStatus = 'online',
  previewBio = 'Смотрю любимые стримы и фильмы в Sferium Homes!',
  showPreviewCard = true,
}) => {
  // Normalize color to uppercase hex if possible
  const currentHex = selectedColor.startsWith('#')
    ? selectedColor.toUpperCase()
    : '#5865F2';

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && val.length > 0) {
      val = '#' + val;
    }
    onChange(val);
  };

  return (
    <div className="space-y-4">
      {/* Discord Profile Card Preview */}
      {showPreviewCard && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Предпросмотр профиля в стиле Discord
            </span>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">{currentHex}</span>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-zinc-950 rounded-2xl border border-zinc-800/90 overflow-hidden shadow-xl"
            style={{
              borderColor: `${currentHex}55`,
            }}
          >
            {/* Banner Header */}
            <div
              className="h-16 w-full relative transition-colors duration-300"
              style={{
                backgroundColor: currentHex,
                backgroundImage: `linear-gradient(135deg, ${currentHex}ee, ${currentHex}88)`,
              }}
            >
              <div className="absolute inset-0 bg-black/15 backdrop-blur-[1px]" />
            </div>

            {/* Profile Content Body */}
            <div className="px-4 pb-4 pt-0 relative space-y-3">
              {/* Overlapping Avatar */}
              <div className="-mt-8 flex items-end justify-between">
                <div className="ring-4 ring-zinc-950 rounded-full">
                  <UserAvatar
                    avatar={previewAvatar}
                    name={previewName}
                    color={currentHex}
                    size="lg"
                    status={previewStatus}
                    showStatus
                    withGlow
                  />
                </div>

                <div
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border backdrop-blur-md"
                  style={{
                    backgroundColor: `${currentHex}20`,
                    borderColor: `${currentHex}60`,
                    color: currentHex,
                  }}
                >
                  Участник
                </div>
              </div>

              {/* User Identity */}
              <div className="space-y-1">
                <h4 className="font-black text-sm text-white tracking-wide flex items-center gap-1.5">
                  <span>{previewName}</span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: currentHex }}
                  />
                </h4>
                {previewBio && (
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {previewBio}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Palette Presets Grid */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-indigo-400" />
          Цветовой акцент
        </label>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {DISCORD_COLOR_PALETTES.map((palette) => {
            const isSelected = currentHex.toLowerCase() === palette.hex.toLowerCase();
            return (
              <motion.button
                key={palette.hex}
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onChange(palette.hex)}
                className={`relative group h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 shadow-lg'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
                style={{
                  backgroundColor: palette.hex,
                }}
                title={`${palette.label} (${palette.desc})`}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-md"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Custom HEX Picker Row */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Pipette className="w-3.5 h-3.5 text-zinc-400" />
          Пользовательский HEX код
        </label>

        <div className="flex items-center gap-2">
          {/* Native Color Pipette trigger */}
          <div className="relative">
            <input
              type="color"
              value={currentHex.startsWith('#') && currentHex.length === 7 ? currentHex : '#5865F2'}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-10 rounded-xl bg-transparent cursor-pointer border border-zinc-800 p-0.5 overflow-hidden"
            />
          </div>

          <div className="relative flex-1">
            <input
              type="text"
              value={selectedColor}
              onChange={handleHexChange}
              placeholder="#5865F2"
              maxLength={7}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-white uppercase outline-none transition-all placeholder:text-zinc-600 shadow-inner"
            />
          </div>

          <div
            className="w-8 h-8 rounded-xl border border-zinc-800 shadow-inner shrink-0"
            style={{ backgroundColor: currentHex }}
          />
        </div>
      </div>
    </div>
  );
};

export default UserColorPicker;
