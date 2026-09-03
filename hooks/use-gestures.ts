'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  GestureGate,
  type GestureAction,
  type GestureFeedback,
} from '@/lib/gestures';
import type { GestureRecognizer } from '@mediapipe/tasks-vision';

export function useGestures(onAction: (action: GestureAction) => void) {
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const actionRef = useRef(onAction);
  useLayoutEffect(() => {
    actionRef.current = onAction;
  });
  const [status, setStatus] = useState<'off' | 'loading' | 'on' | 'error'>(
    'off',
  );
  const [feedback, setFeedback] = useState<GestureFeedback>({
    progress: 0,
    hint: 'カメラはまだオフです',
  });
  const [effect, setEffect] = useState<{
    action: GestureAction;
    id: number;
  } | null>(null);
  const resources = useRef<{
    model: GestureRecognizer | null;
    stream: MediaStream | null;
    raf: number;
    token: number;
  }>({ model: null, stream: null, raf: 0, token: 0 });
  function dispose() {
    const r = resources.current;
    r.token++;
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.stream = null;
    r.model?.close();
    r.model = null;
    if (cameraVideo.current) cameraVideo.current.srcObject = null;
  }
  function stop() {
    dispose();
    setStatus('off');
    setFeedback({ progress: 0, hint: 'カメラをオフにしました' });
  }
  useEffect(() => () => dispose(), []);
  async function start() {
    if (status === 'loading' || status === 'on') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setFeedback({
        progress: 0,
        hint: '空中操作には localhost / HTTPS とカメラが必要です',
      });
      return;
    }
    dispose();
    const token = resources.current.token;
    setStatus('loading');
    setFeedback({ progress: 0, hint: '手の認識を準備しています…' });
    try {
      const { FilesetResolver, GestureRecognizer: Recognizer } =
        await import('@mediapipe/tasks-vision');
      if (token !== resources.current.token) return;
      const vision = await FilesetResolver.forVisionTasks(
        '/vendor/mediapipe/wasm',
      );
      const model = await Recognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/vendor/mediapipe/models/gesture_recognizer.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.65,
        minHandPresenceConfidence: 0.65,
        minTrackingConfidence: 0.6,
      });
      if (token !== resources.current.token) {
        model.close();
        return;
      }
      resources.current.model = model;
      setFeedback({ progress: 0, hint: 'カメラの使用を許可してください' });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (token !== resources.current.token) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      resources.current.stream = stream;
      const cam = cameraVideo.current;
      if (!cam) throw new Error('Camera element missing');
      cam.srcObject = stream;
      await cam.play();
      if (token !== resources.current.token) return;
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (token === resources.current.token) {
            dispose();
            setStatus('error');
            setFeedback({
              progress: 0,
              hint: 'カメラが切断されました。もう一度オンにしてください',
            });
          }
        }),
      );
      setStatus('on');
      const gate = new GestureGate();
      let lastTime = -1,
        lastRun = 0;
      const tick = (now: number) => {
        if (token !== resources.current.token) return;
        if (
          cam.readyState >= 2 &&
          cam.currentTime !== lastTime &&
          now - lastRun >= 83 &&
          document.visibilityState === 'visible'
        ) {
          if (now - lastRun > 500) gate.reset();
          lastTime = cam.currentTime;
          lastRun = now;
          try {
            const result = model.recognizeForVideo(cam, now);
            const f = gate.update(
              {
                hands: result.landmarks,
                labels: result.gestures.map((c) => ({
                  name: c[0]?.categoryName ?? '',
                  score: c[0]?.score ?? 0,
                })),
              },
              now,
            );
            setFeedback(f);
            if (f.action) {
              setEffect({ action: f.action, id: Date.now() });
              actionRef.current(f.action);
            }
          } catch {
            dispose();
            setStatus('error');
            setFeedback({
              progress: 0,
              hint: '手の認識が止まりました。カメラをもう一度オンにしてください',
            });
            return;
          }
        }
        resources.current.raf = requestAnimationFrame(tick);
      };
      resources.current.raf = requestAnimationFrame(tick);
    } catch (error) {
      if (token !== resources.current.token) return;
      const name = error instanceof Error ? error.name : '';
      dispose();
      setStatus('error');
      setFeedback({
        progress: 0,
        hint:
          name === 'NotAllowedError'
            ? 'カメラの許可が必要です。ブラウザーの設定から許可して再度オンにしてください'
            : name === 'NotFoundError'
              ? 'カメラが見つかりません。接続してからもう一度お試しください'
              : name === 'NotReadableError'
                ? 'ほかのアプリがカメラを使用している可能性があります'
                : 'カメラを開始できませんでした。接続を確認して、もう一度オンにしてください',
      });
    }
  }
  return { cameraVideo, status, feedback, effect, start, stop };
}
