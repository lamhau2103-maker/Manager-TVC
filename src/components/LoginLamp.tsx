import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { loadProfileForUser, useAuth } from '../contexts/AuthContext';
import './LoginLamp.css';

interface LoginLampProps {
  onRevealDashboard: () => void;
  onTransitionComplete: () => void;
}

interface DustMote {
  left: number;
  top: number;
  duration: number;
  dx: number;
  dy: number;
}

const BASE = 110;
const MAX = 90;

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err) return false;
  const msg =
    typeof err === 'string'
      ? err
      : typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : '';
  const status = (err as { status?: number }).status;
  if (status === 0) return true;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_connection|timeout/i.test(
    msg
  );
}

export const LoginLamp: React.FC<LoginLampProps> = ({
  onRevealDashboard,
  onTransitionComplete,
}) => {
  const { applyAuthenticatedSession } = useAuth();

  const [isOn, setIsOn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginOk, setLoginOk] = useState(false);
  const [bloomPhase, setBloomPhase] = useState<'idle' | 'expand' | 'fade'>('idle');
  const [bloomCoords, setBloomCoords] = useState({ x: 0, y: 0, r: 1800 });

  // DOM refs
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lampRef = useRef<HTMLDivElement | null>(null);
  const cordRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const userInputRef = useRef<HTMLInputElement | null>(null);
  const passInputRef = useRef<HTMLInputElement | null>(null);

  const coneRef = useRef<HTMLDivElement | null>(null);
  const ambientRef = useRef<HTMLDivElement | null>(null);
  const bulbLitRef = useRef<HTMLDivElement | null>(null);
  const rimLitRef = useRef<HTMLDivElement | null>(null);

  // Mutable animation & audio refs
  const isOnRef = useRef(false);
  const scaleRef = useRef(1);
  const dirRef = useRef(1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dragRef = useRef({ active: false, y0: 0, pull: 0, moved: 0 });
  const timersRef = useRef<number[]>([]);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Generate 18 dust motes inside the light cone (exact formula from original HTML)
  const dustMotes = useMemo<DustMote[]>(() => {
    const list: DustMote[] = [];
    for (let i = 0; i < 18; i++) {
      const y = 260 + Math.random() * 420;
      const half = (y - 218) * 0.36 + 20;
      list.push({
        left: 400 + (Math.random() * 2 - 1) * half,
        top: y,
        duration: 4 + Math.random() * 5,
        dx: Math.random() * 30 - 15,
        dy: Math.random() * 40 - 20,
      });
    }
    return list;
  }, []);

  // Detect touch / coarse pointer devices
  const isTouchDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  }, []);

  // Keep stage scale stable when mobile virtual keyboard shrinks viewport height;
  // only recompute on mount, orientation change, or genuine width change.
  const baseViewportRef = useRef({ width: 0, height: 0, portrait: true });

  useEffect(() => {
    const computeScale = (force = false) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const portrait = h >= w;
      const prev = baseViewportRef.current;

      const widthChanged = Math.abs(w - prev.width) > 20;
      const orientationChanged = prev.width > 0 && portrait !== prev.portrait;
      const heightGrew = h > prev.height + 20;
      const keyboardLikelyOpen =
        !force &&
        !widthChanged &&
        !orientationChanged &&
        prev.height > 0 &&
        h < prev.height - 80 &&
        isTouchDevice();

      if (keyboardLikelyOpen) {
        return;
      }

      if (force || prev.width === 0 || widthChanged || orientationChanged || heightGrew) {
        baseViewportRef.current = { width: w, height: h, portrait };
      } else if (!isTouchDevice()) {
        baseViewportRef.current = { width: w, height: h, portrait };
      }

      const refW = baseViewportRef.current.width || w;
      const refH = baseViewportRef.current.height || h;
      const s = Math.min(1, refH / 840, refW / 440);
      scaleRef.current = s;
      if (stageRef.current) {
        stageRef.current.style.setProperty('--lamp-s', String(s));
      }
    };

    const handleResize = () => computeScale(false);
    const handleOrientation = () => {
      window.setTimeout(() => computeScale(true), 120);
    };

    computeScale(true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, [isTouchDevice]);

  // Keep focused login inputs cleanly visible above virtual keyboard on touch devices
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const updateKeyboardLift = () => {
      if (!stageRef.current) return;
      const baseH = baseViewportRef.current.height || window.innerHeight;
      const kbHeight = Math.max(0, baseH - vv.height);
      const isEditingInput =
        document.activeElement === userInputRef.current ||
        document.activeElement === passInputRef.current;

      if (kbHeight > 110 && isEditingInput && isTouchDevice()) {
        const cardRect = cardRef.current?.getBoundingClientRect();
        const visibleBottom = vv.offsetTop + vv.height - 16;
        if (cardRect && cardRect.bottom > visibleBottom) {
          const currentShift = parseFloat(
            stageRef.current.style.getPropertyValue('--lamp-kb-y') || '0'
          );
          const extraShift = cardRect.bottom - visibleBottom;
          const nextShift = Math.min(340, Math.max(0, currentShift + extraShift));
          stageRef.current.style.setProperty('--lamp-kb-y', `${nextShift}px`);
        }
      } else if (kbHeight < 80) {
        stageRef.current.style.setProperty('--lamp-kb-y', '0px');
      }
    };

    vv.addEventListener('resize', updateKeyboardLift);
    vv.addEventListener('scroll', updateKeyboardLift);
    return () => {
      vv.removeEventListener('resize', updateKeyboardLift);
      vv.removeEventListener('scroll', updateKeyboardLift);
    };
  }, [isTouchDevice]);

  // Web Audio synthesizer (exact waveforms, frequencies, durations & volumes)
  const getAudioContext = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const tone = useCallback(
    (
      type: OscillatorType,
      f0: number,
      f1: number,
      dur: number,
      vol: number,
      delay = 0
    ) => {
      const ac = getAudioContext();
      if (!ac) return;
      try {
        const o = ac.createOscillator();
        const g = ac.createGain();
        const t = ac.currentTime + delay;
        o.type = type;
        o.connect(g);
        g.connect(ac.destination);
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t);
        o.stop(t + dur);
      } catch {
        // Ignore audio errors on restricted devices
      }
    },
    [getAudioContext]
  );

  const snd = useCallback(
    (k: 'pull' | 'on' | 'off' | 'err' | 'ok') => {
      if (k === 'pull') {
        tone('square', 900, 180, 0.03, 0.07);
        tone('square', 700, 150, 0.04, 0.06, 0.07);
      }
      if (k === 'on') {
        tone('sawtooth', 100, 95, 0.5, 0.035, 0.1);
        tone('sine', 2400, 1800, 0.25, 0.03, 0.1);
      }
      if (k === 'off') {
        tone('triangle', 200, 60, 0.08, 0.12, 0.05);
      }
      if (k === 'err') {
        tone('sawtooth', 150, 100, 0.25, 0.12);
      }
      if (k === 'ok') {
        tone('sine', 520, 520, 0.18, 0.1);
        tone('sine', 780, 780, 0.3, 0.1, 0.15);
      }
    },
    [tone]
  );

  // Bulb & cone flicker
  const flick = useCallback((frames: number[], duration: number) => {
    const els = [coneRef.current, ambientRef.current, bulbLitRef.current, rimLitRef.current];
    els.forEach((el) => {
      if (el && typeof el.animate === 'function') {
        el.animate({ opacity: frames }, { duration });
      }
    });
  }, []);

  const triggerShake = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove('lamp-shake');
    void card.offsetWidth;
    card.classList.add('lamp-shake');
  }, []);

  const toggleLamp = useCallback(() => {
    if (loginOk) return;
    const nextOn = !isOnRef.current;
    isOnRef.current = nextOn;
    setIsOn(nextOn);
    snd('pull');
    snd(nextOn ? 'on' : 'off');

    if (lampRef.current) {
      dirRef.current *= -1;
      lampRef.current.style.setProperty('--lamp-a', `${dirRef.current * 3.4}deg`);
      lampRef.current.classList.remove('lamp-swing');
      void lampRef.current.offsetWidth;
      lampRef.current.classList.add('lamp-swing');
    }

    if (nextOn) {
      flick([0, 0.9, 0.1, 1, 0.25, 0.8, 0.15, 1, 0.6, 1], 1000);
      if (!isTouchDevice()) {
        scheduleTimer(() => {
          if (isOnRef.current) {
            userInputRef.current?.focus();
          }
        }, 1700);
      }
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
      stageRef.current?.style.setProperty('--lamp-kb-y', '0px');
    }
  }, [flick, isTouchDevice, loginOk, scheduleTimer, snd]);

  const setPull = useCallback((p: number) => {
    if (cordRef.current) {
      cordRef.current.style.height = `${BASE + p}px`;
    }
  }, []);

  const tug = useCallback(() => {
    if (cordRef.current) {
      cordRef.current.style.transition = 'height .12s';
      setPull(34);
      scheduleTimer(() => {
        if (cordRef.current) {
          cordRef.current.style.transition = '';
          setPull(0);
        }
      }, 120);
    }
    toggleLamp();
  }, [scheduleTimer, setPull, toggleLamp]);

  // Pointer drag handlers for pull-cord knob
  const handleKnobPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (loginOk) return;
    dragRef.current = { active: true, y0: e.clientY, pull: 0, moved: 0 };
    knobRef.current?.setPointerCapture(e.pointerId);
    if (cordRef.current) cordRef.current.style.transition = 'none';
    e.preventDefault();
  };

  const handleKnobPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const p = Math.max(0, Math.min(MAX, (e.clientY - dragRef.current.y0) / scaleRef.current));
    dragRef.current.pull = p;
    dragRef.current.moved = Math.max(dragRef.current.moved, p);
    setPull(p);
  };

  const handleKnobRelease = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const p = dragRef.current.pull;
    const moved = dragRef.current.moved;
    dragRef.current.pull = 0;
    if (moved < 4) {
      tug();
      return;
    }
    if (cordRef.current) cordRef.current.style.transition = '';
    setPull(0);
    if (p > 40) toggleLamp();
  };

  const handleKnobKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tug();
    }
  };

  // Real Supabase Auth sign-in
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || loginOk) return;

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) {
      snd('err');
      flick([1, 0.15, 1, 0.3, 1], 450);
      setErrorMsg('Sai tài khoản hoặc mật khẩu!');
      triggerShake();
      passInputRef.current?.select();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${cleanUser}@tvc.local`,
        password,
      });

      if (error || !data.session || !data.user) {
        snd('err');
        flick([1, 0.15, 1, 0.3, 1], 450);
        setErrorMsg(
          isNetworkError(error)
            ? 'Không kết nối được máy chủ, vui lòng thử lại'
            : 'Sai tài khoản hoặc mật khẩu!'
        );
        triggerShake();
        passInputRef.current?.select();
        setIsSubmitting(false);
        return;
      }

      // Load user profile from `profiles` table
      const profile = await loadProfileForUser(data.user);
      applyAuthenticatedSession(data.session, profile);

      // Success feedback + seamless circular light-bloom transition from bulb
      snd('ok');
      flick([1, 0.55, 1], 350);
      setLoginOk(true);
      setErrorMsg('');

      // Compute exact bulb center coordinates on screen
      const bulbRect = bulbLitRef.current?.getBoundingClientRect();
      const bx = bulbRect ? bulbRect.left + bulbRect.width / 2 : window.innerWidth / 2;
      const by = bulbRect ? bulbRect.top + bulbRect.height / 2 : window.innerHeight * 0.25;
      const maxX = Math.max(bx, window.innerWidth - bx);
      const maxY = Math.max(by, window.innerHeight - by);
      const maxRadius = Math.ceil(Math.hypot(maxX, maxY)) + 48;
      setBloomCoords({ x: bx, y: by, r: maxRadius });

      // Step 1: let success checkmark draw & bulb intensify briefly, then launch 0.8s circular light bloom
      scheduleTimer(() => {
        setBloomPhase('expand');

        // Step 2: once light fills the screen (~800ms), mount dashboard underneath & fade out bloom veil
        scheduleTimer(() => {
          onRevealDashboard();
          setBloomPhase('fade');

          // Step 3: unmount LoginLamp only after fade-out completes
          scheduleTimer(() => {
            onTransitionComplete();
          }, 420);
        }, 800);
      }, 550);
    } catch (err) {
      snd('err');
      flick([1, 0.15, 1, 0.3, 1], 450);
      setErrorMsg(
        isNetworkError(err)
          ? 'Không kết nối được máy chủ, vui lòng thử lại'
          : 'Sai tài khoản hoặc mật khẩu!'
      );
      triggerShake();
      passInputRef.current?.select();
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className={`lamp-scene${isOn ? ' lamp-on' : ''}${
          bloomPhase === 'expand' ? ' lamp-blooming' : ''
        }${bloomPhase === 'fade' ? ' lamp-fading-out' : ''}`}
      >
        <div className="lamp-ambient" ref={ambientRef} />

        <div className="lamp-stage" ref={stageRef}>
          {/* Dust motes in light beam */}
          <div className="lamp-dust">
            {dustMotes.map((m, idx) => (
              <span
                key={idx}
                style={
                  {
                    left: `${m.left}px`,
                    top: `${m.top}px`,
                    '--lamp-d': `${m.duration}s`,
                    '--lamp-dx': `${m.dx}px`,
                    '--lamp-dy': `${m.dy}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          {/* Hanging Lamp */}
          <div className="lamp-fixture" ref={lampRef}>
            <div className="lamp-cone-wrap">
              <div className="lamp-cone" ref={coneRef} />
            </div>
            <div className="lamp-wire" />
            <div className="lamp-cap" />
            <div className="lamp-shade" />
            <div className="lamp-rim" />
            <div className="lamp-rim-lit" ref={rimLitRef} />
            <div className="lamp-bulb" />
            <div className="lamp-bulb-lit" ref={bulbLitRef} />
            <div className="lamp-cord" ref={cordRef}>
              <div className="lamp-chain" />
              <div
                className="lamp-knob"
                ref={knobRef}
                tabIndex={0}
                role="button"
                aria-label="Giật dây để bật hoặc tắt đèn"
                onPointerDown={handleKnobPointerDown}
                onPointerMove={handleKnobPointerMove}
                onPointerUp={handleKnobRelease}
                onPointerCancel={handleKnobRelease}
                onKeyDown={handleKnobKeyDown}
              />
            </div>
          </div>

          <div className="lamp-hint">
            {isOn ? '↓ Giật dây để tắt đèn' : '↓ Giật dây để bật đèn'}
          </div>

          {/* Login Card */}
          <div className={`lamp-card${loginOk ? ' lamp-ok' : ''}`} ref={cardRef}>
            <div className="lamp-form-view">
              <div className="lamp-brand">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffcf72"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 6h13v10H1zM14 9h5l3 3v4h-8z" />
                  <circle cx="6" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                </svg>
                <b>THAI VIET CORPORATION</b>
              </div>
              <div className="lamp-sub">Hệ thống quản lý đội xe · Vui lòng xác thực</div>

              <form onSubmit={handleSubmit} autoComplete="off">
                <div className="lamp-field">
                  <label htmlFor="lamp-username">MÃ TÀI XẾ / ĐIỀU PHỐI</label>
                  <div className="lamp-inp">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      ref={userInputRef}
                      id="lamp-username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="Nhập tài khoản..."
                      autoComplete="off"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="lamp-field">
                  <label htmlFor="lamp-password">MẬT KHẨU</label>
                  <div className="lamp-inp">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      ref={passInputRef}
                      id="lamp-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="••••••"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="lamp-eye"
                      title="Hiện/Ẩn mật khẩu"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={isSubmitting}
                    >
                      👁
                    </button>
                  </div>
                </div>

                <button className="lamp-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP'}
                </button>
                <div className="lamp-msg">{errorMsg}</div>
              </form>
            </div>

            <div className="lamp-done">
              <svg viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" />
                <path d="M20 33l8 8 16-17" />
              </svg>
              <h2>Xác thực thành công</h2>
              <p>Đang vào hệ thống quản lý đội xe...</p>
            </div>
          </div>
        </div>
      </div>

      {/* Circular light-bloom overlay expanding from exact bulb position */}
      <div
        className={`lamp-bloom-veil${
          bloomPhase === 'expand'
            ? ' lamp-bloom-expand'
            : bloomPhase === 'fade'
            ? ' lamp-bloom-fade'
            : ''
        }`}
        style={
          {
            '--lamp-bx': `${bloomCoords.x}px`,
            '--lamp-by': `${bloomCoords.y}px`,
            '--lamp-br': `${bloomCoords.r}px`,
          } as React.CSSProperties
        }
        aria-hidden="true"
      />
    </>
  );
};
