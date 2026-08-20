"use client";

import { useEffect, useState } from "react";
import { EnterpriseIcon } from "@/components/enterprise-navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

const INSTALL_HELP_KEY = "swiftwallet-install-help-dismissed";

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as StandaloneNavigator).standalone);
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PwaController() {
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [helpDismissed, setHelpDismissed] = useState(true);

  useEffect(() => {
    const updateConnection = () => {
      const current = navigator.onLine;
      setOnline(current);
      document.documentElement.dataset.connection = current ? "online" : "offline";
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const blockOfflineSubmission = (event: Event) => {
      if (!navigator.onLine && event.target instanceof HTMLFormElement && event.target.closest(".operations-app")) {
        event.preventDefault();
        setOnline(false);
      }
    };
    const registerServiceWorker = () => {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker
          .register("/sw.js", {
            scope: "/",
            updateViaCache: "none"
          })
          .catch(() => undefined);
      }
    };

    const initialization = window.setTimeout(() => {
      const standalone = isStandaloneMode();
      setInstalled(standalone);
      setShowIosHelp(!standalone && isIosDevice());
      setHelpDismissed(window.sessionStorage.getItem(INSTALL_HELP_KEY) === "true");
      updateConnection();
    }, 0);

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    document.addEventListener("submit", blockOfflineSubmission, true);

    if (document.readyState === "complete") registerServiceWorker();
    else window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("load", registerServiceWorker);
      document.removeEventListener("submit", blockOfflineSubmission, true);
      window.clearTimeout(initialization);
      delete document.documentElement.dataset.connection;
    };
  }, []);

  const dismissHelp = () => {
    window.sessionStorage.setItem(INSTALL_HELP_KEY, "true");
    setHelpDismissed(true);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  const showInstallHelp = !installed && !helpDismissed && (installPrompt !== null || showIosHelp);

  if (online && !showInstallHelp) return null;

  return (
    <section aria-label="Estado de la aplicación" className="pwa-status-region">
      {!online ? (
        <div className="pwa-notice is-offline" role="alert">
          <div>
            <strong>Sin conexión · operaciones bloqueadas</strong>
            <p>Recupera la conexión para continuar.</p>
          </div>
        </div>
      ) : null}
      {showInstallHelp ? (
        <div className="pwa-notice is-install">
          <span className="pwa-notice-icon" aria-hidden="true"><EnterpriseIcon name="download" /></span>
          <div>
            <strong>Instala SwiftWallet en este dispositivo</strong>
            <p>{showIosHelp ? "En Safari, toca Compartir y después Agregar a pantalla de inicio." : "Crea un acceso directo para abrir la operación sin buscarla en el navegador."}</p>
          </div>
          {installPrompt ? <button className="pwa-install-button" onClick={install} type="button">Instalar</button> : null}
          <button aria-label="Ocultar instrucciones de instalación" className="pwa-dismiss-button" onClick={dismissHelp} type="button"><EnterpriseIcon name="close" /></button>
        </div>
      ) : null}
    </section>
  );
}
