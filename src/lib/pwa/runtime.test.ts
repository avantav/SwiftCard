import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const controller = source("../../components/pwa-controller.tsx");
const layout = source("../../app/app/layout.tsx");
const rootLayout = source("../../app/layout.tsx");
const serviceWorker = source("../../../public/sw.js");
const offlinePage = source("../../../public/offline.html");
const nextConfig = source("../../../next.config.mjs");
const styles = source("../../app/globals.css");

describe("PWA runtime contract", () => {
  it("registers the worker, handles install affordances and reports connectivity", () => {
    expect(layout).toContain("PwaController");
    expect(controller).toContain('.register("/sw.js"');
    expect(controller).toContain('updateViaCache: "none"');
    expect(controller).toContain('window.addEventListener("beforeinstallprompt"');
    expect(controller).toContain('(display-mode: standalone)');
    expect(controller).toContain("Agregar a pantalla de inicio");
    expect(controller).toContain('window.addEventListener("offline"');
    expect(controller).toContain('document.addEventListener("submit", blockOfflineSubmission, true)');
    expect(controller).toContain("operaciones bloqueadas");
  });

  it("keeps tenant and session data out of offline storage", () => {
    expect(serviceWorker).toContain('const OFFLINE_URL = "/offline.html"');
    expect(serviceWorker).toContain("cache.add(OFFLINE_URL)");
    expect(serviceWorker).toContain('event.request.mode !== "navigate"');
    expect(serviceWorker).not.toContain("cache.addAll");
    expect(serviceWorker).not.toContain('"/app"');
    expect(serviceWorker).not.toContain("supabase");
    expect(serviceWorker).not.toContain("localStorage");
    expect(offlinePage).toContain("no guarda datos operativos");
    expect(offlinePage).not.toContain("<script");
    expect(offlinePage).not.toContain("onclick=");
  });

  it("publishes Apple metadata and secure no-cache worker headers", () => {
    expect(rootLayout).toContain("appleWebApp");
    expect(rootLayout).toContain("apple-touch-icon.png");
    expect(rootLayout).toContain('viewportFit: "cover"');
    expect(nextConfig).toContain('source: "/sw.js"');
    expect(nextConfig).toContain("no-cache, no-store, must-revalidate");
    expect(nextConfig).toContain("Service-Worker-Allowed");
  });

  it("disables automatic and manual zoom only in the operations PWA", () => {
    expect(styles).toContain('.operations-app input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
    expect(styles).toContain(".operations-app select");
    expect(styles).toContain(".operations-app textarea");
    expect(styles).toMatch(/\.operations-app textarea \{\s*font-size: 16px;/);
    expect(styles).toMatch(/\.operations-app \{[\s\S]*?touch-action: pan-x pan-y;/);
    expect(layout).toContain("maximumScale: 1");
    expect(layout).toContain("userScalable: false");
    expect(rootLayout).not.toContain("userScalable: false");
    expect(rootLayout).not.toContain("maximumScale: 1");
  });
});
