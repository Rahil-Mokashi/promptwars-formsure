import { useEffect, useRef } from 'react';

const COLORS = ['#4338CA', '#059669', '#D97706', '#E11D48', '#A5B4FC', '#6EE7B7', '#FDE68A'];

interface Particle {
  x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string; life: number;
}

/** One confetti burst on a full-screen canvas. Only rendered when motion is allowed. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d'); // null in jsdom: nothing to draw
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const parts: Particle[] = Array.from({ length: 140 }, (_, i) => {
      const side = i % 2 === 0 ? 0 : 1; // two cannons at the bottom corners
      const angle = (side === 0 ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
      const speed = 11 + Math.random() * 9;
      return {
        x: side === 0 ? W * 0.12 : W * 0.88, y: H * 0.85,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6, h: 10 + Math.random() * 8,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[i % COLORS.length] as string, life: 1,
      };
    });

    let raf = 0;
    let frame = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.32; // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - frame / 170);
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (frame < 170) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="confetti-canvas" aria-hidden="true" />;
}
