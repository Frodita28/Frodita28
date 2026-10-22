"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

/**
 * Lector de QR con la cámara del móvil. Usa el lector nativo del navegador
 * (BarcodeDetector) cuando existe y, si no, decodifica los fotogramas con jsQR.
 */
export function QrScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    // Evita leer el mismo QR varias veces seguidas mientras sigue frente a la cámara.
    let last = { text: "", at: 0 };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara. Escribe el código de la etiqueta.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setError("No se pudo abrir la cámara. Revisa los permisos o escribe el código de la etiqueta.");
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const native = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          let text: string | null = null;
          if (native) {
            const found = await native.detect(video).catch(() => []);
            text = found[0]?.rawValue ?? null;
          } else if (jsQR && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          }
          const now = Date.now();
          if (text && (text !== last.text || now - last.at > 2500)) {
            last = { text, at: now };
            navigator.vibrate?.(60);
            onCodeRef.current(text);
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-ash bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-bronze/80" aria-hidden />
        </div>
      )}
      <button type="button" onClick={onClose} className="btn-ghost w-full text-sm">Cerrar cámara</button>
    </div>
  );
}
