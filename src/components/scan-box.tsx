"use client";

import { Camera, CameraOff, ScanLine } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ActionState } from "@/lib/action";

// BarcodeDetector is in Chrome on Android but not yet in TypeScript's DOM types.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

const noopSubscribe = () => () => {};

/**
 * Ticket input for handhelds. Works three ways:
 * - Bluetooth / built-in scanners that "type" the code and press Enter,
 * - the phone camera (Chrome on Android, via BarcodeDetector),
 * - typing the number by hand.
 */
export function ScanBox({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  // false while server-rendering; the real answer once running in the browser.
  const cameraSupported = useSyncExternalStore(
    noopSubscribe,
    () => !!window.BarcodeDetector && !!navigator.mediaDevices,
    () => false,
  );
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const submit = (ticket: string) => {
    const fd = new FormData();
    fd.set("ticket", ticket);
    startTransition(() => formAction(fd));
  };

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector!({ formats: ["code_128"] });
        const tick = async () => {
          if (stopped) return;
          const codes = await detector.detect(video).catch(() => []);
          if (codes[0]?.rawValue) {
            navigator.vibrate?.(80);
            setScanning(false);
            if (inputRef.current) inputRef.current.value = codes[0].rawValue;
            submit(codes[0].rawValue);
            return;
          }
          timer = setTimeout(tick, 200);
        };
        tick();
      } catch {
        setCameraError("Camera not available. Allow camera access, or type the ticket number.");
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // submit is stable enough for this effect; re-running on each render would restart the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className="card space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(inputRef.current?.value ?? "");
        }}
      >
        <label className="sr-only" htmlFor="ticket">
          Ticket number
        </label>
        <input
          ref={inputRef}
          id="ticket"
          name="ticket"
          className="input h-14 flex-1 font-mono text-lg"
          placeholder="Scan or type ticket"
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          enterKeyHint="go"
        />
        <button className="btn btn-primary h-14 px-5" disabled={pending} aria-label="Open bale">
          <ScanLine size={20} aria-hidden />
        </button>
      </form>

      {cameraSupported && (
        <button type="button" className="btn h-12 w-full" onClick={() => setScanning((s) => !s)}>
          {scanning ? <CameraOff size={18} aria-hidden /> : <Camera size={18} aria-hidden />}
          {scanning ? "Stop camera" : "Scan with camera"}
        </button>
      )}
      {scanning && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-accent shadow-[0_0_12px_var(--accent)]" />
        </div>
      )}
      {(state?.error || cameraError) && (
        <p role="alert" className="text-sm text-danger">
          {state?.error ?? cameraError}
        </p>
      )}
    </div>
  );
}
