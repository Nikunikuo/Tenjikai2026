'use client';

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Film,
  MousePointer2,
  Play,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Clip } from '@/hooks/use-player';
import {
  browseWork,
  ReelGesture,
  VISITOR_IDLE_MS,
  workSlots,
} from '@/lib/visitor';

type Props = {
  clips: Clip[];
  active: string | null;
  playing: boolean;
  onSelect: (id: string) => void;
};
type Ripple = { id: number; x: number; y: number };

export function VisitorControls({ clips, active, playing, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [browsed, setBrowsed] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [feedback, setFeedback] = useState('');
  const layer = useRef<HTMLDivElement>(null);
  const entry = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const gesture = useRef(new ReelGesture());
  const capture = useRef<{ target: Element; id: number } | null>(null);
  const suppressClick = useRef(false);
  const restoreEntry = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const serial = useRef(0);
  const ids = clips.map((clip) => clip.id);
  const selected = ids.includes(browsed ?? '')
    ? browsed
    : ids.includes(active ?? '')
      ? active
      : ids[0];
  const selectedClip = clips.find((clip) => clip.id === selected);
  const selectedIsCurrent = selectedClip?.id === active && !selectedClip.failed;
  const slots = workSlots(ids, selected);

  const release = () => {
    const held = capture.current;
    capture.current = null;
    if (held?.target.hasPointerCapture(held.id))
      held.target.releasePointerCapture(held.id);
    gesture.current.cancel();
    setOffset(0);
    setDragging(false);
  };
  const close = (restoreFocus = false) => {
    clearTimeout(idle.current);
    suppressClick.current = true;
    release();
    restoreEntry.current =
      restoreFocus && !!panel.current?.contains(document.activeElement);
    setOpen(false);
  };
  const touch = () => {
    clearTimeout(idle.current);
    idle.current = setTimeout(() => close(), VISITOR_IDLE_MS);
  };
  const addRipple = (clientX: number, clientY: number) => {
    const bounds = layer.current?.getBoundingClientRect();
    if (!bounds) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const ripple = {
      id: ++serial.current,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
    setRipples((old) => (reduced ? [ripple] : [...old.slice(-2), ripple]));
    clearTimeout(rippleTimer.current);
    rippleTimer.current = setTimeout(
      () => setRipples([]),
      reduced ? 650 : 1900,
    );
  };
  const pulse = (event: MouseEvent<HTMLButtonElement>, text = '') => {
    // Pointer taps are handled once at the whole surface. Keyboard activation
    // has no pointer coordinates, so its ripple starts at the button centre.
    if (event.detail === 0) {
      const target = event.currentTarget.getBoundingClientRect();
      addRipple(target.left + target.width / 2, target.top + target.height / 2);
    }
    if (text) {
      setFeedback(text);
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(''), 1600);
    }
  };
  const openWorks = (event: MouseEvent<HTMLButtonElement>) => {
    setBrowsed(active ?? ids[0]);
    suppressClick.current = false;
    pulse(event);
    setOpen(true);
    touch();
  };
  const browse = (direction: number) => {
    setBrowsed((old) =>
      browseWork(ids, ids.includes(old ?? '') ? old : selected, direction),
    );
    touch();
  };
  const choose = (event: MouseEvent<HTMLButtonElement>, clip: Clip) => {
    const keepCurrent = clip.id === active && !clip.failed;
    pulse(
      event,
      keepCurrent
        ? 'そのまま上映に戻ります'
        : clip.failed
          ? 'もう一度、再生を試みます'
          : '上映をはじめます',
    );
    if (!keepCurrent) onSelect(clip.id);
    close();
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (!gesture.current.start(event.pointerId, event.clientX, event.clientY))
      return;
    suppressClick.current = false;
    const target =
      (event.target as Element).closest('button') ?? event.currentTarget;
    // Capture on the original button so an ordinary tap still clicks that card.
    target.setPointerCapture(event.pointerId);
    capture.current = { target, id: event.pointerId };
    touch();
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const move = gesture.current.move(
      event.pointerId,
      event.clientX,
      event.clientY,
    );
    if (!move) return;
    if (move.dragged) {
      suppressClick.current = true;
      setDragging(true);
      setOffset(Math.max(-120, Math.min(120, move.dx)));
      touch();
    }
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const result = gesture.current.end(
      event.pointerId,
      event.clientX,
      event.clientY,
      event.currentTarget.clientWidth,
    );
    if (!result) return;
    suppressClick.current = result.dragged;
    release();
    if (result.direction) browse(result.direction);
    else touch();
  };
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
    else if (restoreEntry.current) {
      restoreEntry.current = false;
      entry.current?.focus({ preventScroll: true });
    }
  }, [open]);
  useEffect(() => {
    const node = layer.current;
    if (!node) return;
    let press: { id: number; x: number; y: number; moved: boolean } | null =
      null;
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      press = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!press || press.id !== event.pointerId) return;
      // Leave room for aerial-sensor jitter; an intentional browse starts at 48px.
      press.moved ||=
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > 24;
    };
    const up = (event: PointerEvent) => {
      if (!press || press.id !== event.pointerId) return;
      const tapped = !press.moved;
      press = null;
      if (tapped) addRipple(event.clientX, event.clientY);
    };
    const cancel = (event: PointerEvent) => {
      if (press?.id === event.pointerId) press = null;
    };
    node.addEventListener('pointerdown', down, true);
    node.addEventListener('pointermove', move, true);
    node.addEventListener('pointerup', up, true);
    node.addEventListener('pointercancel', cancel, true);
    return () => {
      node.removeEventListener('pointerdown', down, true);
      node.removeEventListener('pointermove', move, true);
      node.removeEventListener('pointerup', up, true);
      node.removeEventListener('pointercancel', cancel, true);
    };
  }, []);
  useEffect(
    () => () => {
      clearTimeout(idle.current);
      clearTimeout(feedbackTimer.current);
      clearTimeout(rippleTimer.current);
      const held = capture.current;
      if (held?.target.hasPointerCapture(held.id))
        held.target.releasePointerCapture(held.id);
    },
    [],
  );

  return (
    <div ref={layer} className="visitor-layer">
      <Button
        ref={entry}
        variant="ghost"
        className="visitor-entry"
        aria-label="作品を選ぶ画面を開く"
        aria-expanded={open}
        aria-controls="visitor-works"
        tabIndex={open ? -1 : 0}
        onClick={openWorks}
      >
        <span className="visitor-invitation">
          <MousePointer2 size={16} /> 画面に触れて、作品を選ぶ
        </span>
      </Button>
      {open && (
        <dialog
          open
          ref={panel}
          id="visitor-works"
          className="visitor-panel"
          aria-label="作品を選ぶ"
          tabIndex={-1}
          onPointerDownCapture={touch}
          onFocusCapture={touch}
          onKeyDown={(event) => {
            touch();
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.focus({ preventScroll: true });
              browse(event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}
        >
          <div className="visitor-heading">
            <div>
              <p className="eyebrow">PICK YOUR NEXT MOMENT</p>
              <h2>次は、どの作品にする？</h2>
            </div>
            <Button
              variant="ghost"
              className="visitor-close"
              onClick={(event) => {
                pulse(event);
                close(event.detail === 0);
              }}
              aria-label="作品選択を閉じて上映に戻る"
            >
              <X size={20} />
              <span>戻る</span>
            </Button>
          </div>
          <div
            className={`visitor-reel ${dragging ? 'is-browsing' : ''}`}
            aria-label="左右にドラッグして作品を選ぶ"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={(event) => {
              if (capture.current?.id === event.pointerId) {
                suppressClick.current = true;
                release();
                touch();
              }
            }}
            onLostPointerCapture={(event) => {
              if (capture.current?.id === event.pointerId) {
                suppressClick.current = true;
                release();
              }
            }}
            onClickCapture={(event) => {
              if (event.detail !== 0 && suppressClick.current) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            <div
              className="visitor-track"
              style={{ transform: `translate(calc(-50% + ${offset}px), -50%)` }}
            >
              {slots.map((id, slot) => {
                const clip = clips.find((item) => item.id === id);
                if (!clip)
                  return (
                    <span
                      className="work-spacer"
                      aria-hidden="true"
                      key={`empty-${slot}`}
                    />
                  );
                const index = ids.indexOf(clip.id);
                const isCurrent = clip.id === active && !clip.failed;
                return (
                  <Button
                    key={clip.id}
                    variant="outline"
                    className={`work-card ${slot === 1 ? 'is-selected' : ''} ${clip.failed ? 'is-unavailable' : ''}`}
                    onClick={(event) => choose(event, clip)}
                    aria-label={`${index + 1}. ${clip.name} を${clip.failed ? '再試行' : isCurrent ? '現在の状態のまま上映画面へ戻る' : '再生'}`}
                    aria-current={clip.id === active ? 'true' : undefined}
                  >
                    <span className="work-topline">
                      <Film size={18} />
                      <span>
                        {clip.failed
                          ? '再生できません'
                          : clip.id === active
                            ? playing
                              ? '上映中'
                              : '一時停止中'
                            : 'LOCAL FILM'}
                      </span>
                    </span>
                    <span className="work-number" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <strong>{clip.name.replace(/\.[^.]+$/, '')}</strong>
                    <span className="work-cta">
                      <Play size={14} fill="currentColor" />
                      {clip.failed
                        ? 'タッチして再試行'
                        : isCurrent
                          ? 'タッチして戻る'
                          : 'タッチして再生'}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="visitor-navigation">
            <Button
              variant="outline"
              className="visitor-skip"
              disabled={clips.length < 2}
              onClick={(event) => {
                pulse(event);
                browse(-1);
              }}
              aria-label="前の作品を選ぶ"
            >
              <ArrowLeft size={23} />
              <span>前の作品</span>
            </Button>
            <Button
              className="visitor-play"
              disabled={!selectedClip}
              onClick={(event) => {
                if (selectedClip) choose(event, selectedClip);
              }}
            >
              <Play size={22} fill="currentColor" />
              <span>
                {selectedIsCurrent ? '現在のまま上映へ戻る' : 'この作品を再生'}
                <small>
                  {String(ids.indexOf(selected ?? '') + 1).padStart(2, '0')} /{' '}
                  {String(clips.length).padStart(2, '0')}
                </small>
              </span>
            </Button>
            <Button
              variant="outline"
              className="visitor-skip"
              disabled={clips.length < 2}
              onClick={(event) => {
                pulse(event);
                browse(1);
              }}
              aria-label="次の作品を選ぶ"
            >
              <span>次の作品</span>
              <ArrowRight size={23} />
            </Button>
          </div>
          <p className="visitor-note" aria-live="polite">
            左右にスライドして選ぶ · 12秒操作しないと上映画面に戻ります
          </p>
          <output className="sr-only">選択中: {selectedClip?.name}</output>
        </dialog>
      )}
      <div className="visitor-effects" aria-hidden="true">
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="touch-ripple"
            style={{ left: ripple.x, top: ripple.y }}
            onAnimationEnd={(event) => {
              if (event.currentTarget === event.target)
                setRipples((old) =>
                  old.filter((item) => item.id !== ripple.id),
                );
            }}
          >
            <i className="ripple-bloom" />
            <i className="ripple-ring ripple-ring-one" />
            <i className="ripple-ring ripple-ring-two" />
            <i className="ripple-ring ripple-ring-three" />
            <i className="ripple-impact" />
          </span>
        ))}
      </div>
      <output
        className={`visitor-feedback ${feedback ? 'is-visible' : ''}`}
        aria-live="polite"
      >
        {feedback}
      </output>
    </div>
  );
}
