import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

interface SoftAuroraProps {
  active?: boolean;
  intensity?: number;
  color1?: string;
  color2?: string;
  lightMode?: boolean;
  className?: string;
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Adapted from React Bits Soft Aurora. The reduced octave count and capped
// render loop keep the always-on call visualization inexpensive on iOS.
const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uLightMode;

#define TAU 6.2831853

vec3 gradientHash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 234.6)),
    dot(p, vec3(269.5, 183.3, 198.3)),
    dot(p, vec3(169.5, 283.3, 156.9))
  );
  vec3 h = fract(sin(p) * 43758.5453123);
  float phi = acos(2.0 * h.x - 1.0);
  float theta = TAU * h.y;
  return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
}

float smoothQuintic(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float perlin3D(vec3 p) {
  vec3 f = floor(p);
  vec3 c = ceil(p);
  vec3 s = vec3(smoothQuintic(fract(p.x)), smoothQuintic(fract(p.y)), smoothQuintic(fract(p.z)));
  float d000 = dot(gradientHash(vec3(f.x, f.y, f.z)), p - vec3(f.x, f.y, f.z));
  float d100 = dot(gradientHash(vec3(c.x, f.y, f.z)), p - vec3(c.x, f.y, f.z));
  float d010 = dot(gradientHash(vec3(f.x, c.y, f.z)), p - vec3(f.x, c.y, f.z));
  float d110 = dot(gradientHash(vec3(c.x, c.y, f.z)), p - vec3(c.x, c.y, f.z));
  float d001 = dot(gradientHash(vec3(f.x, f.y, c.z)), p - vec3(f.x, f.y, c.z));
  float d101 = dot(gradientHash(vec3(c.x, f.y, c.z)), p - vec3(c.x, f.y, c.z));
  float d011 = dot(gradientHash(vec3(f.x, c.y, c.z)), p - vec3(f.x, c.y, c.z));
  float d111 = dot(gradientHash(vec3(c.x, c.y, c.z)), p - vec3(c.x, c.y, c.z));
  float x00 = mix(d000, d100, s.x);
  float x10 = mix(d010, d110, s.x);
  float x01 = mix(d001, d101, s.x);
  float x11 = mix(d011, d111, s.x);
  return mix(mix(x00, x10, s.y), mix(x01, x11, s.y), s.z);
}

float band(vec2 uv, float time, float offset) {
  vec2 p = uv * vec2(2.0, 2.8);
  float noise = perlin3D(vec3(p, time + offset));
  noise += 0.22 * perlin3D(vec3(p * 2.1, time * 0.72 + offset));
  float center = 0.50 + noise * (0.20 + uIntensity * 0.10);
  float distanceToBand = abs(uv.y - center);
  float edgeDistance = min(uv.x, 1.0 - uv.x);
  float taper = smoothstep(0.005, 0.14, edgeDistance);
  float thickness = mix(0.003, 0.055 + uIntensity * 0.026, pow(taper, 0.68));
  float body = exp(-pow(distanceToBand / thickness, 1.32));
  return body * smoothstep(0.002, 0.035, edgeDistance);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float time = uTime * (0.12 + uIntensity * 0.18);
  float glow1 = band(uv, time, 0.0);
  float glow2 = band(vec2(1.0 - uv.x, uv.y), time, 3.7);
  float horizontalFade = smoothstep(0.0, 0.035, uv.x) * smoothstep(0.0, 0.035, 1.0 - uv.x);
  float verticalFade = smoothstep(0.02, 0.28, uv.y) * smoothstep(0.02, 0.24, 1.0 - uv.y);
  float pulse = 0.88 + 0.12 * sin(uTime * 0.7);
  vec3 color = uColor1 * glow1 + uColor2 * glow2;
  // Keep hue independent from brightness in light mode. Sending dim RGB with
  // alpha to a white surface creates a grey fringe even when the source hues
  // are saturated.
  float glowSum = max(glow1 + glow2, 0.0001);
  vec3 chroma = (uColor1 * glow1 + uColor2 * glow2) / glowSum;
  float neutral = min(chroma.r, min(chroma.g, chroma.b));
  chroma = max(chroma - vec3(neutral * 0.82), vec3(0.0));
  float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
  chroma = chroma / max(chromaPeak, 0.0001);
  color = mix(color, mix(vec3(1.0), chroma, 0.94), uLightMode);
  float themeStrength = mix(0.22, 0.58, uLightMode);
  float alpha = clamp((glow1 + glow2) * horizontalFade * verticalFade * pulse * (themeStrength + uIntensity * 0.58), 0.0, 0.92);
  if (uLightMode > 0.5) {
    float ink = clamp((glow1 + glow2) * horizontalFade * verticalFade * pulse * (0.62 + uIntensity * 0.52), 0.0, 0.88);
    vec3 lightSurface = mix(vec3(1.0), chroma, ink);
    gl_FragColor = vec4(lightSurface, 1.0);
  } else {
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
  }
}
`;

function hexToVec3(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
}

export default function SoftAurora({
  active = true,
  intensity = 0,
  color1 = '#22d3ee',
  color2 = '#6366f1',
  lightMode = false,
  className = '',
}: SoftAuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef({ active, intensity });

  useEffect(() => {
    activityRef.current = { active, intensity };
  }, [active, intensity]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      dpr: Math.min(window.devicePixelRatio, 1.5),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [1, 1, 1] },
        uIntensity: { value: 0 },
        uColor1: { value: hexToVec3(color1) },
        uColor2: { value: hexToVec3(color2) },
        uLightMode: { value: lightMode ? 1 : 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    const resize = () => {
      renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
      program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height];
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    container.appendChild(gl.canvas);
    resize();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    let lastFrame = 0;
    let displayedIntensity = 0;
    const render = (time: number) => {
      animationFrame = requestAnimationFrame(render);
      if (document.hidden || time - lastFrame < 1000 / 30) return;
      lastFrame = time;
      const target = activityRef.current.active ? Math.min(1, activityRef.current.intensity) : 0;
      displayedIntensity += (target - displayedIntensity) * 0.12;
      program.uniforms.uIntensity.value = displayedIntensity;
      program.uniforms.uTime.value = reduceMotion ? 0 : time * 0.001;
      renderer.render({ scene: mesh });
    };
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      gl.canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [color1, color2, lightMode]);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
