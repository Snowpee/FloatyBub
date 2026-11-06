import { useEffect, useRef } from 'react';

/** Two soft ellipses: a slow idle orbit, with axes and speed driven by output RMS. */
export default function VoiceAvatarAura({ intensity }: { intensity: number }) {
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const level = useRef(intensity);
  useEffect(() => { level.current = intensity; }, [intensity]);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = 0;
    let phase = 0;
    let envelope = 0;
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      const dt = Math.min((time - previous) / 1000, 0.05);
      previous = time;
      if (document.hidden) return;
      envelope += (level.current - envelope) * (1 - Math.exp(-dt / (level.current > envelope ? 0.055 : 0.18)));
      phase += dt * (0.32 + envelope * 2.2);
      [first.current, second.current].forEach((ellipse, index) => {
        if (!ellipse) return;
        const t = motion.matches ? index * 2 : phase + index * 2.3;
        const energy = motion.matches ? 0 : envelope;
        const x = 1.05 + Math.sin(t * 1.3) * 0.14 + energy * 0.2;
        const y = 0.78 + Math.cos(t * 0.9) * 0.12 + energy * 0.15;
        ellipse.style.transform = `translate(${Math.sin(t) * 9}px, ${Math.cos(t * 1.2) * 8}px) rotate(${t * (index ? -42 : 35)}deg) scale(${x}, ${y})`;
        ellipse.style.opacity = String(0.32 + energy * 0.12);
      });
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div className="pointer-events-none absolute -inset-3" aria-hidden="true">
    <div ref={first} className="absolute inset-0 rounded-[50%] bg-indigo-400 blur-[12px]" />
    <div ref={second} className="absolute inset-0 rounded-[50%] bg-cyan-300 blur-[12px]" />
  </div>;
}
