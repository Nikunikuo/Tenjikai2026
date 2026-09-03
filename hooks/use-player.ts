'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { nextPlayable } from '@/lib/playlist';
export type Clip = {
  id: string;
  name: string;
  url: string;
  size: number;
  failed?: boolean;
};
export const formatTime = (v: number) =>
  Number.isFinite(v)
    ? `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`
    : '0:00';
export function usePlayer() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [fit, setFit] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState(
    '動画を追加して、上映の準備をしましょう。',
  );
  const [wakeState, setWakeState] = useState(
    '再生中は画面スリープの防止を試みます',
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const wantPlay = useRef(false);
  const urls = useRef(new Set<string>());
  const failures = useRef(new Set<string>());
  const generation = useRef(0);
  const lastAdvance = useRef(-Infinity);
  const deferredRevokes = useRef<string[]>([]);
  const state = useRef({ clips, active, locked, playing });
  useLayoutEffect(() => {
    state.current = { clips, active, locked, playing };
  });
  useEffect(() => {
    deferredRevokes.current = deferredRevokes.current.filter((url) => {
      if (
        video.current?.currentSrc === url ||
        video.current?.getAttribute('src') === url
      )
        return true;
      URL.revokeObjectURL(url);
      urls.current.delete(url);
      return false;
    });
  }, [active, clips]);
  const current = clips.find((c) => c.id === active);
  const index = clips.findIndex((c) => c.id === active);
  const hasClips = clips.length > 0;
  useEffect(() => {
    const owned = urls.current;
    return () => owned.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    if (video.current) {
      video.current.volume = volume;
      video.current.muted = muted;
    }
  }, [volume, muted, active]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('air-loop-settings') ?? '{}',
      );
      queueMicrotask(() => {
        if (typeof saved.volume === 'number' && Number.isFinite(saved.volume))
          setVolume(Math.max(0, Math.min(1, saved.volume)));
        if (typeof saved.muted === 'boolean') setMuted(saved.muted);
        if (typeof saved.fit === 'boolean') setFit(saved.fit);
      });
    } catch {
      /* Playback is independent of storage. */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        'air-loop-settings',
        JSON.stringify({ volume, muted, fit }),
      );
    } catch {
      /* Private browser mode remains usable. */
    }
  }, [volume, muted, fit]);
  useEffect(() => {
    let lock: WakeLockSentinel | null = null,
      cancelled = false,
      retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const acquire = async () => {
      if (!playing || document.visibilityState !== 'visible' || lock) return;
      if (!('wakeLock' in navigator)) {
        setWakeState('画面スリープの防止は、このブラウザーでは未対応です');
        return;
      }
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await next.release();
          return;
        }
        lock = next;
        setWakeState('画面スリープを防止中');
        next.addEventListener('release', () => {
          lock = null;
          if (!cancelled) {
            setWakeState('スリープ防止が解除されています');
            if (retries++ < 3 && document.visibilityState === 'visible')
              retryTimer = setTimeout(() => void acquire(), 2000 * retries);
          }
        });
      } catch {
        if (!cancelled) setWakeState('端末のスリープ設定をご確認ください');
      }
    };
    if (!playing)
      queueMicrotask(() => {
        if (!cancelled) setWakeState('再生中は画面スリープの防止を試みます');
      });
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [playing]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setControlsVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setControlsVisible(false), 3500);
    };
    show();
    const node = stage.current;
    node?.addEventListener('pointermove', show);
    node?.addEventListener('pointerdown', show);
    node?.addEventListener('focusin', show);
    return () => {
      clearTimeout(timer);
      node?.removeEventListener('pointermove', show);
      node?.removeEventListener('pointerdown', show);
      node?.removeEventListener('focusin', show);
    };
  }, [hasClips]);
  const addFiles = (files: FileList | File[]) => {
    if (state.current.locked) {
      setNotice('展示ロックを解除すると動画を追加できます。');
      return;
    }
    const added = Array.from(files)
      .filter(
        (f) =>
          f.type.startsWith('video/') ||
          /\.(mp4|webm|m4v|mov|ogv|mkv)$/i.test(f.name),
      )
      .map((f) => {
        const url = URL.createObjectURL(f);
        urls.current.add(url);
        return { id: crypto.randomUUID(), name: f.name, url, size: f.size };
      });
    if (!added.length) {
      setNotice('動画ファイルを選んでください。MP4 / WebM をおすすめします。');
      return;
    }
    setClips((old) => [...old, ...added]);
    if (!active) setActive(added[0].id);
    setNotice(
      `${added.length} 本の動画を追加しました。再生ボタンで上映を開始できます。`,
    );
  };
  const play = () => {
    if (!video.current || !state.current.active) return;
    wantPlay.current = true;
    const ticket = generation.current;
    video.current.play().catch((error: unknown) => {
      if (
        ticket !== generation.current ||
        (error instanceof Error && error.name === 'AbortError')
      )
        return;
      wantPlay.current = false;
      setPlaying(false);
      setNotice(
        '再生ボタンを押して上映を開始してください。再生できない場合は MP4 / WebM をお試しください。',
      );
    });
  };
  const toggle = () => {
    if (!video.current || !state.current.active) return;
    if (video.current.paused) play();
    else {
      wantPlay.current = false;
      video.current.pause();
    }
  };
  const select = (id: string, autoPlay = true, retry = true) => {
    if (!state.current.clips.some((c) => c.id === id)) return;
    if (retry) {
      failures.current.delete(id);
      setClips((old) =>
        old.map((c) => (c.id === id ? { ...c, failed: false } : c)),
      );
    }
    generation.current++;
    wantPlay.current = autoPlay;
    if (state.current.active === id) {
      if (video.current) {
        video.current.currentTime = 0;
        if (video.current.error) video.current.load();
      }
      if (autoPlay) play();
    } else {
      video.current?.pause();
      state.current.active = id;
      setPosition(0);
      setDuration(0);
      setActive(id);
    }
  };
  const step = (direction: number) => {
    if (
      !state.current.clips.length ||
      performance.now() - lastAdvance.current < 280
    )
      return;
    lastAdvance.current = performance.now();
    const next = nextPlayable(
      state.current.clips,
      state.current.active,
      direction,
      failures.current,
    );
    if (next) {
      select(next.id, true, false);
      return;
    }
    wantPlay.current = false;
    setPlaying(false);
    setNotice('再生できる動画がありません。別の動画を追加してください。');
  };
  const remove = (id: string) => {
    if (locked) return;
    const clip = clips.find((c) => c.id === id),
      remaining = clips.filter((c) => c.id !== id);
    if (id === active) {
      video.current?.pause();
      const next =
        remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id ??
        null;
      state.current.active = next;
      state.current.clips = remaining;
      setActive(next);
      setPosition(0);
      setDuration(0);
    }
    setClips(remaining);
    if (!remaining.length) {
      wantPlay.current = false;
      setPlaying(false);
    }
    if (id === active) generation.current++;
    failures.current.delete(id);
    if (clip) {
      if (id === active) deferredRevokes.current.push(clip.url);
      else {
        URL.revokeObjectURL(clip.url);
        urls.current.delete(clip.url);
      }
    }
  };
  const move = (i: number, d: number) => {
    if (locked || i + d < 0 || i + d >= clips.length) return;
    setClips((old) => {
      const next = [...old];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  };
  const seek = (value: number) => {
    if (video.current && Number.isFinite(duration)) {
      video.current.currentTime = Math.max(0, Math.min(value, duration));
      setPosition(value);
    }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      setNotice('全画面にできませんでした。ブラウザーの F11 も使えます。');
    }
  };
  const isCurrentMedia = (e: SyntheticEvent<HTMLVideoElement>) => {
    const expected = state.current.clips.find(
      (c) => c.id === state.current.active,
    );
    return (
      e.currentTarget === video.current &&
      !!expected &&
      e.currentTarget.currentSrc === expected.url
    );
  };
  const mediaEvents = {
    onPlay: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isCurrentMedia(e)) setPlaying(true);
    },
    onPause: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isCurrentMedia(e)) setPlaying(false);
    },
    onTimeUpdate: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isCurrentMedia(e)) setPosition(e.currentTarget.currentTime);
    },
    onDurationChange: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isCurrentMedia(e))
        setDuration(
          Number.isFinite(e.currentTarget.duration)
            ? e.currentTarget.duration
            : 0,
        );
    },
    onLoadedData: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isCurrentMedia(e) && wantPlay.current) play();
    },
    onEnded: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (isCurrentMedia(e) && e.currentTarget.ended) {
        lastAdvance.current = -Infinity;
        step(1);
      }
    },
    onError: (e: SyntheticEvent<HTMLVideoElement>) => {
      const { active: id, clips: list } = state.current;
      if (
        !id ||
        !isCurrentMedia(e) ||
        !e.currentTarget.error ||
        failures.current.has(id)
      )
        return;
      failures.current.add(id);
      setClips((old) =>
        old.map((c) => (c.id === id ? { ...c, failed: true } : c)),
      );
      const next = nextPlayable(list, id, 1, failures.current);
      if (next) {
        const resume = wantPlay.current;
        select(next.id, resume, false);
        setNotice(
          '再生できない動画を飛ばしました。プレイリストから選び直すと再試行できます。',
        );
      } else {
        wantPlay.current = false;
        setPlaying(false);
        setNotice(
          'すべての動画を再生できません。MP4（H.264）/ WebM の動画を追加してください。',
        );
      }
    },
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.defaultPrevented ||
        target.closest('#visitor-works') ||
        target.matches('input,textarea,select,button') ||
        target.isContentEditable ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.code === 'KeyF') void fullscreen();
      else if (e.code === 'KeyM') setMuted((v) => !v);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
  return {
    clips,
    active,
    currentClip: current,
    index,
    playing,
    position,
    duration,
    volume,
    setVolume,
    muted,
    setMuted,
    fit,
    setFit,
    locked,
    setLocked,
    notice,
    setNotice,
    wakeState,
    controlsVisible,
    video,
    stage,
    addFiles,
    play,
    toggle,
    select,
    step,
    remove,
    move,
    seek,
    fullscreen,
    mediaEvents,
  };
}
