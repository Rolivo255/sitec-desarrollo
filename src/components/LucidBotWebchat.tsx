import { useEffect } from 'react';

declare global {
  interface Window {
    ktt10?: {
      setup: (config: { id: string; accountId: string; color?: string }) => void;
    };
  }
}

const LUCIDBOT_SCRIPT_ID = 'lucidbot-webchat-script';
const LUCIDBOT_SCRIPT_SRC = 'https://panel.lucidbot.co/webchat/plugin.js?v=6';
const LUCIDBOT_CONFIG = {
  id: 'vRzSE73EhC',
  accountId: '1686616',
  color: '#006dff',
};
const LUCIDBOT_POLL_INTERVAL_MS = 200;
const LUCIDBOT_POLL_MAX_ATTEMPTS = 50; // ~10s de espera tras cargar el script

// Modulo-level: sobrevive a remounts (p.ej. React.StrictMode) para no llamar setup() dos veces.
let lucidBotSetupDone = false;

/**
 * Inyecta el Webchat oficial de LucidBot (https://panel.lucidbot.co) una sola vez
 * por sesion de la app. No renderiza nada: el widget se dibuja a si mismo como
 * boton flotante una vez que ktt10.setup() se ejecuta.
 */
const LucidBotWebchat = () => {
  useEffect(() => {
    if (lucidBotSetupDone) return;

    let pollId: number | undefined;
    let attempts = 0;

    const trySetup = (): boolean => {
      if (lucidBotSetupDone) return true;
      if (window.ktt10?.setup) {
        window.ktt10.setup(LUCIDBOT_CONFIG);
        lucidBotSetupDone = true;
        return true;
      }
      return false;
    };

    const startPolling = () => {
      if (trySetup()) return;
      // El script puede disparar "load" antes de dejar listo window.ktt10.
      pollId = window.setInterval(() => {
        attempts += 1;
        if (trySetup() || attempts >= LUCIDBOT_POLL_MAX_ATTEMPTS) {
          if (pollId !== undefined) window.clearInterval(pollId);
          if (!lucidBotSetupDone) {
            console.warn('[LucidBot] ktt10 no estuvo disponible tras cargar el script del Webchat.');
          }
        }
      }, LUCIDBOT_POLL_INTERVAL_MS);
    };

    const existingScript = document.getElementById(LUCIDBOT_SCRIPT_ID);

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = LUCIDBOT_SCRIPT_ID;
      script.src = LUCIDBOT_SCRIPT_SRC;
      script.async = true;
      script.addEventListener('load', startPolling);
      script.addEventListener('error', () => {
        console.error('[LucidBot] No se pudo cargar el script del Webchat.');
      });
      document.body.appendChild(script);
    } else {
      startPolling();
    }

    return () => {
      if (pollId !== undefined) {
        window.clearInterval(pollId);
      }
    };
  }, []);

  return null;
};

export default LucidBotWebchat;
