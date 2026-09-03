/* oxlint-disable jsx-a11y/media-has-caption -- Playback uses arbitrary local user videos; the app has no transcript to attach. */
'use client';

import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  Film,
  FolderOpen,
  Infinity as InfinityIcon,
  Maximize,
  Pause,
  Play,
  Plus,
  Radio,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { VisitorControls } from '@/components/visitor-controls';
import { usePlayer, formatTime } from '@/hooks/use-player';
import { usePlayerTools } from '@/hooks/use-player-tools';

export default function Home() {
  const { video: videoRef, stage: stageRef, ...p } = usePlayer();
  usePlayerTools({ clips: p.clips, active: p.active, playing: p.playing });
  const input = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <main className="air-app">
      <header className="topbar">
        <div className="brand" aria-label="AIR LOOP">
          <span className="brand-icon">
            <InfinityIcon size={27} />
          </span>
          <span>
            AIR<span className="brand-light">LOOP</span>
            <small>EXHIBITION PLAYER</small>
          </span>
        </div>
        <span className="header-center">
          <i className="status-dot" />
          YOUR SPACE. YOUR SCREEN.
        </span>
        <div className="header-actions">
          <span className="local-badge">
            <ShieldCheck size={14} /> ローカル再生
          </span>
          <Button
            className="outline-button"
            variant="outline"
            onClick={p.fullscreen}
          >
            <Maximize size={15} />
            全画面
          </Button>
        </div>
      </header>
      <section className="workspace-heading">
        <div>
          <p className="eyebrow">THE SCREEN IS YOURS</p>
          <h1>好きな映像を、途切れない体験に。</h1>
        </div>
        <span className="session-tag">
          <Radio size={14} /> EXHIBITION SESSION
        </span>
      </section>
      <div className="workspace">
        <section className="player-column">
          <div
            ref={stageRef}
            className={`screen ${dragging ? 'is-dragging' : ''} ${!p.controlsVisible && p.currentClip ? 'hide-controls' : ''}`}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              setDragging(false);
              p.addFiles(e.dataTransfer.files);
            }}
          >
            {p.currentClip ? (
              <video
                key={p.currentClip.id}
                ref={videoRef}
                src={p.currentClip.url}
                playsInline
                preload="auto"
                className={p.fit ? 'cover-video' : ''}
                {...p.mediaEvents}
              />
            ) : (
              <div className="empty-screen">
                <span className="screen-corner top-left" />
                <span className="screen-corner top-right" />
                <span className="screen-corner bottom-left" />
                <span className="screen-corner bottom-right" />
                <span className="empty-orbit">
                  <Film size={33} strokeWidth={1.2} />
                </span>
                <p className="eyebrow">READY WHEN YOU ARE</p>
                <h2>ここから、上映がはじまる。</h2>
                <p>動画をドロップして、あなただけの上映会を。</p>
                <Button
                  className="primary-button"
                  onClick={() => input.current?.click()}
                  disabled={p.locked}
                >
                  <Plus size={16} /> 動画を選ぶ <ArrowUpRight size={15} />
                </Button>
                <span className="format-note">
                  MP4 · WebM · MOV* / 複数選択できます
                </span>
              </div>
            )}
            <div className="screen-top">
              <span className="live-label">
                <i className={p.playing ? 'status-dot' : 'idle-dot'} />
                {p.playing ? 'NOW PLAYING' : 'STANDBY'}
              </span>
              <span className="loop-badge">
                <InfinityIcon size={16} /> LOOP ALL
              </span>
            </div>
            {p.currentClip && (
              <div className="screen-bottom">
                <span>
                  {String(p.index + 1).padStart(2, '0')}{' '}
                  <span className="muted-text">
                    / {String(p.clips.length).padStart(2, '0')}
                  </span>
                </span>
                <strong>{p.currentClip.name.replace(/\.[^.]+$/, '')}</strong>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={p.toggle}
                  aria-label={p.playing ? '一時停止' : '再生'}
                >
                  {p.playing ? <Pause /> : <Play />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => p.step(1)}
                  aria-label="次の動画"
                >
                  <SkipForward />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={p.fullscreen}
                  aria-label="全画面を切り替え"
                >
                  <Maximize />
                </Button>
              </div>
            )}
            {p.currentClip && (
              <VisitorControls
                clips={p.clips}
                active={p.active}
                playing={p.playing}
                onSelect={p.select}
              />
            )}
            {dragging && (
              <div className="drop-overlay">
                <Plus size={40} />
                {p.locked
                  ? '展示ロックを解除して追加'
                  : 'ここにドロップして追加'}
              </div>
            )}
          </div>
          <div className="transport">
            <div className="seek-row">
              <span>{formatTime(p.position)}</span>
              <input
                type="range"
                aria-label="再生位置"
                min="0"
                max={p.duration || 1}
                value={Math.min(p.position, p.duration || 1)}
                step="0.1"
                disabled={!p.currentClip}
                onChange={(e) => p.seek(Number(e.target.value))}
              />
              <span>{formatTime(p.duration)}</span>
            </div>
            <div className="controls-row">
              <div className="volume-control">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={p.muted ? 'ミュート解除' : 'ミュート'}
                  onClick={() => p.setMuted(!p.muted)}
                >
                  {p.muted ? <VolumeX /> : <Volume2 />}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={p.muted ? 0 : p.volume}
                  aria-label="音量"
                  onChange={(e) => {
                    p.setVolume(Number(e.target.value));
                    p.setMuted(false);
                  }}
                />
              </div>
              <div className="play-controls">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!p.currentClip}
                  onClick={() => p.step(-1)}
                  aria-label="前の動画"
                >
                  <SkipBack />
                </Button>
                <Button
                  className="play-button"
                  disabled={!p.currentClip}
                  onClick={p.toggle}
                  aria-label={p.playing ? '一時停止' : '再生'}
                >
                  {p.playing ? (
                    <Pause fill="currentColor" />
                  ) : (
                    <Play fill="currentColor" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!p.currentClip}
                  onClick={() => p.step(1)}
                  aria-label="次の動画"
                >
                  <SkipForward />
                </Button>
              </div>
              <Button
                className="fit-button"
                variant="ghost"
                onClick={() => p.setFit(!p.fit)}
              >
                {p.fit ? '画面を埋める' : '全体を表示'}{' '}
                <ChevronRight size={12} />
              </Button>
            </div>
          </div>
          <div className="now-row">
            <span>
              <InfinityIcon size={16} />{' '}
              最後の動画が終わると、先頭から繰り返します
            </span>
            <span>
              {p.clips.length
                ? `${p.clips.length} VIDEOS IN LOOP`
                : 'NO VIDEO YET'}
            </span>
          </div>
        </section>
        <aside className="playlist">
          <div className="playlist-heading">
            <div>
              <p className="eyebrow">YOUR COLLECTION</p>
              <h2>
                プレイリスト{' '}
                <span>{String(p.clips.length).padStart(2, '0')}</span>
              </h2>
            </div>
            <Button
              className="add-square"
              variant="outline"
              size="icon"
              onClick={() => input.current?.click()}
              disabled={p.locked}
              aria-label="動画を追加"
            >
              <Plus />
            </Button>
          </div>
          <div className="playlist-toolbar">
            <span>
              <InfinityIcon size={14} /> 全件ループ
            </span>
            <button disabled={p.locked} onClick={() => folder.current?.click()}>
              <FolderOpen size={14} /> フォルダーを選ぶ
            </button>
          </div>
          <div className="clip-list">
            {p.clips.length ? (
              p.clips.map((clip, i) => (
                <div
                  className={`clip ${clip.id === p.active ? 'active' : ''} ${clip.failed ? 'failed' : ''}`}
                  key={clip.id}
                >
                  <button
                    className="clip-select"
                    onClick={() => p.select(clip.id)}
                  >
                    <span className="clip-number">
                      {clip.id === p.active && p.playing ? (
                        <span className="equalizer">
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        String(i + 1).padStart(2, '0')
                      )}
                    </span>
                    <span className="clip-text">
                      <strong>{clip.name}</strong>
                      <small>
                        {clip.failed
                          ? '再生できません'
                          : clip.id === p.active
                            ? '選択中'
                            : `${(clip.size / 1024 / 1024).toFixed(1)} MB`}
                      </small>
                    </span>
                  </button>
                  <div className="clip-actions">
                    <button
                      disabled={p.locked || i === 0}
                      onClick={() => p.move(i, -1)}
                      aria-label={`${clip.name} を上へ`}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      disabled={p.locked || i === p.clips.length - 1}
                      onClick={() => p.move(i, 1)}
                      aria-label={`${clip.name} を下へ`}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      disabled={p.locked}
                      onClick={() => p.remove(clip.id)}
                      aria-label={`${clip.name} を削除`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="playlist-empty">
                <span>01</span>
                <div className="empty-lines">
                  <i />
                  <i />
                </div>
                <p>
                  最初の一本を追加しよう。
                  <small>好きな順番に並べて、そのままループ。</small>
                </p>
              </div>
            )}
          </div>
          <Button
            className="playlist-add"
            variant="outline"
            onClick={() => input.current?.click()}
            disabled={p.locked}
          >
            <Plus size={15} /> 動画を追加する
          </Button>
          <div className="exhibit-setting">
            <div>
              <strong>展示ロック</strong>
              <small>動画の追加・削除・並び替えを固定</small>
            </div>
            <Switch
              checked={p.locked}
              onCheckedChange={p.setLocked}
              aria-label="展示ロック"
            />
          </div>
          <p className="playlist-note">
            <ShieldCheck size={13} /> 動画はこの端末内で再生されます。
            <br />
            ファイルがアップロードされることはありません。
          </p>
        </aside>
      </div>
      <div className="session-help">
        <span>
          <span className="keyboard-key">Space</span> 再生 / 停止{' '}
          <span className="keyboard-key">← →</span> 前 / 次{' '}
          <span className="keyboard-key">F</span> 全画面{' '}
          <span className="keyboard-key">M</span> 消音
        </span>
        <span>{p.wakeState}</span>
      </div>
      <p className="file-help">
        * 対応形式はブラウザーによって異なります。MP4（H.264）/ WebM
        推奨。ページを再読み込みした場合は、動画を選び直してください。
      </p>
      <footer>
        <output aria-live="polite">
          <Check size={13} />
          {p.notice}
        </output>
        <span>
          AIR LOOP <i /> MADE FOR THE MOMENT
        </span>
      </footer>
      <input
        ref={input}
        type="file"
        accept="video/*,.mkv,.mov,.m4v"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) p.addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folder}
        type="file"
        accept="video/*"
        multiple
        hidden
        {...{ webkitdirectory: '' }}
        onChange={(e) => {
          if (e.target.files)
            p.addFiles(
              Array.from(e.target.files).sort((a, b) =>
                a.name.localeCompare(b.name, 'ja', { numeric: true }),
              ),
            );
          e.target.value = '';
        }}
      />
    </main>
  );
}
