import React, { useEffect, useRef, useState } from 'react';
import { LogOut, CheckCircle2, ShieldCheck, UserCheck } from 'lucide-react';

declare global {
  interface Window {
    VKIDSDK?: any;
  }
}

interface VKAuthProps {
  onSuccess?: (userData?: any) => void;
}

export const VKAuth: React.FC<VKAuthProps> = ({ onSuccess }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return !!(localStorage.getItem('sferium_vk_token') || localStorage.getItem('vk_access_token'));
  });

  const handleLogout = () => {
    localStorage.removeItem('sferium_vk_token');
    localStorage.removeItem('vk_access_token');
    localStorage.removeItem('sferium_vk_user_id');
    localStorage.removeItem('vk_user_id');
    setIsAuthorized(false);
    setError(null);
    if (onSuccess) onSuccess();
  };

  useEffect(() => {
    if (isAuthorized) return;

    let isMounted = true;

    const initVKID = () => {
      if (!window.VKIDSDK || !containerRef.current || !isMounted) return;

      try {
        const VKID = window.VKIDSDK;

        VKID.Config.init({
          app: 54701725,
          redirectUrl: 'https://sferium.homes/api/auth/vk/callback',
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        });

        const oAuth = new VKID.OAuthList();

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const vkidOnError = (err: any) => {
          console.error('VK ID Widget Error:', err);
          if (isMounted) {
            setError('Не удалось выполнить взимодействие с VK ID.');
          }
        };

        const vkidOnSuccess = (data: any) => {
          console.log('VK ID Success Data:', data);
          if (data?.access_token) {
            localStorage.setItem('sferium_vk_token', data.access_token);
            localStorage.setItem('vk_access_token', data.access_token);
          }
          if (data?.user_id) {
            localStorage.setItem('sferium_vk_user_id', String(data.user_id));
            localStorage.setItem('vk_user_id', String(data.user_id));
          }
          if (isMounted) {
            setIsAuthorized(true);
            setError(null);
          }
          if (onSuccess) onSuccess(data);
        };

        oAuth
          .render({
            container: containerRef.current,
            oauthList: ['vkid', 'ok_ru', 'mail_ru'],
          })
          .on(VKID.WidgetEvents.ERROR, vkidOnError)
          .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload: any) {
            const code = payload.code;
            const deviceId = payload.device_id;

            if (VKID.Auth && VKID.Auth.exchangeCode) {
              VKID.Auth.exchangeCode(code, deviceId)
                .then(vkidOnSuccess)
                .catch(vkidOnError);
            } else {
              vkidOnSuccess(payload);
            }
          });
      } catch (e: any) {
        console.error('VK ID init exception:', e);
      }
    };

    if (window.VKIDSDK) {
      setSdkLoaded(true);
      initVKID();
    } else {
      const existingScript = document.getElementById('vkid-sdk-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'vkid-sdk-script';
        script.src = 'https://unpkg.com/@vkid/sdk@2.4.0/dist-sdk/umd/index.js';
        script.async = true;
        script.onload = () => {
          if (isMounted) {
            setSdkLoaded(true);
            initVKID();
          }
        };
        script.onerror = () => {
          if (isMounted) {
            setError('Не удалось загрузить виджет VK ID');
          }
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => {
          if (isMounted) {
            setSdkLoaded(true);
            initVKID();
          }
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthorized, onSuccess]);

  if (isAuthorized) {
    return (
      <div className="w-full bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
              <span>VK ID подключен</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.2 rounded">
                Опционально
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">
              Доступ к защищенным видеозаписям активен
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-2.5 py-1.5 bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
          title="Выйти из VK ID"
        >
          <LogOut className="w-3 h-3" />
          <span>Выйти</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center py-2 space-y-2">
      {error && (
        <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 px-3 py-1.5 rounded-xl">
          {error}
        </div>
      )}
      
      <div className="w-full flex justify-center min-h-[48px]" ref={containerRef} />
      
      {!sdkLoaded && !error && (
        <div className="text-xs text-indigo-300 py-2 animate-pulse flex items-center gap-2 font-medium">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          Загрузка виджета входа VK ID...
        </div>
      )}

      <p className="text-[10px] text-zinc-400 text-center px-2">
        Вход через VK ID, Одноклассники или Mail.ru опционален и ускоряет доступ.
      </p>
    </div>
  );
};

