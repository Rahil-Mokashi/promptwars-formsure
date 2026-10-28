import { useEffect, useRef } from 'react';

const COLORS = ['#4338CA', '#059669', '#D97706', '#E11D48', '#A5B4FC', '#6EE7B7', '#FDE68A'] as const;
const PARTICLES = 140;
const FRAMES = 170;
const GRAVITY = 0.32;
const DRAG = 0.99;
const CANNON_Y = 0.85; // fraction of the viewport height
const CANNON_X = [0.12, 0.88] as const;
const ANGLES_DEG = [-60, -120] as const;
const ANGLE_SPREAD = 0.7;
const SPEED_MIN = 11;
const SPEED_RANGE = 9;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
}

const launch = (index: number, width: number, height: number): Particle => {
  const side = index % 2;
  const angle = (ANGLES_DEG[side] ?? -90) * (Math.PI / 180) + (Math.random() - 0.5) * ANGLE_SPREAD;
  const speed = SPEED_MIN + Math.random() * SPEED_RANGE;
  return {
    x: width * (CANNON_X[side] ?? 0.5),
    y: height * CANNON_Y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: COLORS[index % COLORS.length] ?? COLORS[0],
  };
};

/** One confetti burst on a full-screen canvas. Only rendered when motion is allowed. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d'); // null in jsdom: nothing to draw
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { innerWidth: W, innerHeight: H } = window;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const particles = Array.from({ length: PARTICLES }, (_, i) => launch(i, W, H));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / FRAMES);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (frame < FRAMES) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="confetti-canvas" aria-hidden="true" />;
}
