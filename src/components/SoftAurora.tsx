import { useEffect, useId, useRef } from 'react';

interface SoftAuroraProps {
  active?: boolean;
  intensity?: number;
  className?: string;
}

const WIDTH = 1000;
const HEIGHT = 160;

function wavePath(base: number, amplitude: number, phase: number, frequency: number) {
  const points = Array.from({ length: 13 }, (_, index) => {
    const x = (WIDTH / 12) * index;
    const primary = Math.sin(phase + index * frequency) * amplitude;
    const secondary = Math.sin(phase * -0.48 + index * frequency * 0.53) * amplitude * 0.24;
    return [x, base + primary + secondary] as const;
  });

  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    const beforePrevious = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 2)];
    const control1X = previous[0] + (point[0] - beforePrevious[0]) / 6;
    const control1Y = previous[1] + (point[1] - beforePrevious[1]) / 6;
    const control2X = point[0] - (next[0] - previous[0]) / 6;
    const control2Y = point[1] - (next[1] - previous[1]) / 6;
    return `C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${point[0]} ${point[1]}`;
  });

  // Extend the fill beyond the viewport so Gaussian blur never fades to white
  // along the bottom or side edges. The SVG viewport clips the excess.
  const bleed = 40;
  return `M ${-bleed} ${points[0][1]} L ${points[0][0]} ${points[0][1]} ${segments.join(' ')} L ${WIDTH + bleed} ${points[points.length - 1][1]} L ${WIDTH + bleed} ${HEIGHT + bleed} L ${-bleed} ${HEIGHT + bleed} Z`;
}

/**
 * Two real translucent SVG surfaces. Each path is painted independently so
 * their overlap uses the browser's standard source-over compositing.
 */
export default function SoftAurora({
  active = true,
  intensity = 0,
  className = '',
}: SoftAuroraProps) {
  const filterId = useId();
  const backWaveRef = useRef<SVGPathElement>(null);
  const frontWaveRef = useRef<SVGPathElement>(null);
  const activityRef = useRef({ active, intensity });

  useEffect(() => {
    activityRef.current = { active, intensity };
  }, [active, intensity]);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;
    let previousFrame = 0;
    let displayedIntensity = 0;
    let phase = 0;

    const render = (time: number) => {
      animationFrame = requestAnimationFrame(render);
      if (document.hidden || time - previousFrame < 1000 / 30) return;
      const dt = Math.min((time - previousFrame) / 1000, 0.1);
      previousFrame = time;

      const target = activityRef.current.active
        ? Math.min(1, Math.max(0, Number.isFinite(activityRef.current.intensity) ? activityRef.current.intensity : 0))
        : 0;
      displayedIntensity += (target - displayedIntensity) * (1 - Math.exp(-dt / (target > displayedIntensity ? 0.05 : 0.18)));
      phase += dt * (0.28 + displayedIntensity * 1.8);
      const elapsed = motion.matches ? 0 : phase;
      const response = motion.matches ? 0 : displayedIntensity * 36;

      backWaveRef.current?.setAttribute(
        'd',
        wavePath(79, 25 + response, elapsed + 0.55, 0.51),
      );
      frontWaveRef.current?.setAttribute(
        'd',
        wavePath(98, 23 + response * 0.82, -elapsed * 1.24 + 3.65, 0.63),
      );
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return <svg
    className={className}
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <filter id={filterId} x="-3%" y="-15%" width="106%" height="130%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
    </defs>
    <path
      ref={backWaveRef}
      d={wavePath(79, 25, 0.55, 0.51)}
      fill="hsla(239, 100%, 66%, 0.2)"
      filter={`url(#${filterId})`}
    />
    <path
      ref={frontWaveRef}
      d={wavePath(98, 23, 3.65, 0.63)}
      fill="hsla(197, 100%, 66%, 0.2)"
      filter={`url(#${filterId})`}
    />
  </svg>;
}
