import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertCircle, CheckCircle2, RefreshCw, User, ExternalLink } from 'lucide-react';
import { userManager } from '../modules/user';
import { AuthProviderType } from '../types';

declare global {
  interface Window {
    VKIDSDK?: any;
  }
}

interface AuthButtonsProps {
  onSuccess?: () => void;
  onContinueAsGuest?: () => void;
  showGuestButton?: boolean;
}

export const AuthButtons: React.FC<AuthButtonsProps> = ({
  onSuccess,
  onContinueAsGuest,
  showGuestButton = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkLoading, setSdkLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Load SDK script if not already in document
    const initWidget = () => {
      if (!isMounted) return;

      if (!window.VKIDSDK) {
        // Wait or dynamically check
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (window.VKIDSDK) {
            clearInterval(interval);
            if (isMounted) renderOneTapWidget();
          } else if (attempts > 30) {
            clearInterval(interval);
            if (isMounted) {
              setSdkLoading(false);
              setErrorMsg('Не удалось загрузить скрипт VK ID SDK. Проверьте подключение к сети.');
            }
          }
        }, 150);
        return () => clearInterval(interval);
      } else {
        renderOneTapWidget();
      }
    };

    const renderOneTapWidget = () => {
      if (!containerRef.current || !window.VKIDSDK || !isMounted) return;

      try {
        const VKID = window.VKIDSDK;

        // Initialize VK ID Config as requested
        VKID.Config.init({
          app: 54701725,
          redirectUrl: 'https://sferium.homes/api/auth/vk/callback',
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        });

        const oneTap = new VKID.OneTap();

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const vkidOnError = (error: any) => {
          console.error('[VKID OneTap] Widget Error:', error);
          if (isMounted) {
            setIsProcessing(false);
            setErrorMsg('Ошибка входа через VK ID / Одноклассники / Mail.ru.');
          }
        };

        const vkidOnSuccess = (data: any) => {
          console.log('[VKID OneTap] Auth Success Result:', data);
          if (isMounted) {
            setIsProcessing(false);
            setSuccessMsg('Авторизация успешно завершена!');
          }

          // Extract token & user details
          const token = data?.access_token || data?.token;
          const userId = data?.user_id || data?.id || data?.sub;
          const provider: AuthProviderType = data?.oauth_provider === 'ok_ru' 
            ? 'ok' 
            : data?.oauth_provider === 'mail_ru' 
            ? 'mail' 
            : 'vk';

          // Upgrade guest profile to registered user
          userManager.upgradeGuestToUser({
            userId,
            provider,
            token,
            userInfo: data?.user || data?.user_info,
            email: data?.email,
            phone: data?.phone,
          });

          if (onSuccess) {
            onSuccess();
          }
        };

        oneTap
          .render({
            container: containerRef.current,
            showAlternativeLogin: true,
            oauthList: ['ok_ru', 'mail_ru'],
          })
          .on(VKID.WidgetEvents.ERROR, vkidOnError)
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload: any) => {
            if (isMounted) {
              setIsProcessing(true);
              setErrorMsg(null);
            }

            const code = payload?.code;
            const deviceId = payload?.device_id;

            if (VKID.Auth && VKID.Auth.exchangeCode && code && deviceId) {
              VKID.Auth.exchangeCode(code, deviceId)
                .then(vkidOnSuccess)
                .catch(vkidOnError);
            } else {
              // Direct payload fallback
              vkidOnSuccess(payload);
            }
          });

        if (isMounted) {
          setSdkLoading(false);
        }
      } catch (err: any) {
        console.error('[VKID OneTap] Exception during render:', err);
        if (isMounted) {
          setSdkLoading(false);
          setErrorMsg('Не удалось инициализировать виджет OneTap.');
        }
      }
    };

    initWidget();

    return () => {
      isMounted = false;
    };
  }, [onSuccess]);

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Alert or Feedback */}
      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-2xl flex items-start space-x-2.5 text-xs text-rose-300"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">{errorMsg}</span>
          </div>
        </motion.div>
      )}

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center space-x-2.5 text-xs text-emerald-300"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {/* Main VK ID OneTap Container */}
      <div className="relative w-full rounded-2xl bg-zinc-950/80 border border-zinc-800/80 p-4 shadow-inner min-h-[110px] flex flex-col items-center justify-center">
        {sdkLoading && (
          <div className="flex items-center space-x-2.5 text-xs text-zinc-400">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Загрузка VK ID OneTap...</span>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10 text-xs text-white font-bold space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Авторизация...</span>
          </div>
        )}

        {/* DOM target where VKID.OneTap().render({ container }) injects */}
        <div ref={containerRef} className="w-full flex items-center justify-center" />
      </div>

      {/* Continue as Guest Button */}
      {showGuestButton && (
        <div className="pt-2 border-t border-zinc-850 flex flex-col space-y-2">
          <button
            type="button"
            onClick={() => {
              if (onContinueAsGuest) {
                onContinueAsGuest();
              }
            }}
            className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
          >
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span>Продолжить без регистрации (как гость)</span>
          </button>
          <p className="text-[11px] text-zinc-500 text-center">
            Все функции кинозала, чата и голосового эфира доступны в гостевом режиме
          </p>
        </div>
      )}
    </div>
  );
};

export default AuthButtons;
