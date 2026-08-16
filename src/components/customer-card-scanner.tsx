"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { resolveScannedCard } from "@/app/app/scan/actions";
import { parseCardQrPayload } from "@/lib/scanner/qr";

type ScannerState = "idle" | "starting" | "scanning" | "submitting" | "error";

export function CustomerCardScanner() {
  const [state, setState] = useState<ScannerState>("idle");
  const [message, setMessage] = useState(
    "Abre la cámara y apunta al QR que aparece en la tarjeta del cliente.",
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const payloadRef = useRef<HTMLInputElement>(null);
  const scanLockedRef = useRef(false);

  function stopCamera(nextState: ScannerState = "idle") {
    controlsRef.current?.stop();
    controlsRef.current = null;
    scanLockedRef.current = false;
    setState(nextState);
    if (nextState === "idle") {
      setMessage("La cámara está cerrada. Puedes abrirla o buscar al cliente por nombre o teléfono.");
    }
  }

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setState("error");
      setMessage("Este navegador no permite usar la cámara. Busca al cliente por nombre o teléfono.");
      return;
    }

    controlsRef.current?.stop();
    controlsRef.current = null;
    scanLockedRef.current = false;
    setState("starting");
    setMessage("Solicitando permiso para usar la cámara…");

    try {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 800,
      });
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            height: { ideal: 720 },
            width: { ideal: 1280 },
          },
        },
        videoRef.current,
        (result, _error, activeControls) => {
          if (!result || scanLockedRef.current) return;
          const scanned = result.getText();
          const parsed = parseCardQrPayload(scanned);
          if (!parsed.ok) {
            scanLockedRef.current = true;
            activeControls.stop();
            setState("error");
            setMessage("El código detectado no es una tarjeta SwiftWallet. Intenta nuevamente.");
            return;
          }
          if (!navigator.onLine) {
            scanLockedRef.current = true;
            activeControls.stop();
            setState("error");
            setMessage("No hay conexión. Conéctate a internet antes de validar la tarjeta.");
            return;
          }

          scanLockedRef.current = true;
          activeControls.stop();
          setState("submitting");
          setMessage("Tarjeta detectada. Validando cliente…");
          if (payloadRef.current) payloadRef.current.value = scanned;
          formRef.current?.requestSubmit();
        },
      );
      controlsRef.current = controls;
      if (scanLockedRef.current) {
        controls.stop();
        return;
      }
      setState("scanning");
      setMessage("Cámara activa. Mantén el QR dentro del recuadro.");
    } catch (error) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setState("error");
      setMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "No se concedió acceso a la cámara. Habilítalo en el navegador o busca al cliente."
          : "No se pudo iniciar la cámara. Revisa que otra aplicación no la esté usando o busca al cliente.",
      );
    }
  }

  const cameraActive = state === "starting" || state === "scanning";

  return (
    <div className="operations-scanner">
      <div className={`operations-camera ${cameraActive ? "is-active" : ""}`}>
        <video
          aria-label="Vista de la cámara para escanear el QR"
          muted
          playsInline
          ref={videoRef}
        />
        <div className="operations-scan-frame" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      </div>
      <p
        className={`operations-scanner-status ${state === "error" ? "is-error" : ""}`}
        role={state === "error" ? "alert" : "status"}
      >
        {message}
      </p>
      <div className="operations-camera-actions">
        <button
          className="operations-primary-button"
          disabled={state === "starting" || state === "submitting"}
          onClick={startCamera}
          type="button"
        >
          {state === "starting" ? "Abriendo cámara…" : cameraActive ? "Reiniciar cámara" : "Abrir cámara"}
        </button>
        {cameraActive ? (
          <button
            className="operations-secondary-button"
            onClick={() => stopCamera()}
            type="button"
          >
            Cerrar cámara
          </button>
        ) : null}
      </div>
      <form action={resolveScannedCard} aria-hidden="true" ref={formRef}>
        <input name="payload" ref={payloadRef} type="hidden" />
      </form>
    </div>
  );
}
