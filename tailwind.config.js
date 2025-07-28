/** @type {import('tailwindcss').Config} */

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    // DaisyUI 组件类
    'badge', 'badge-primary', 'badge-secondary', 'badge-accent',
    'btn', 'btn-primary', 'btn-secondary', 'btn-accent',
    'bg-base-100', 'bg-base-200', 'bg-base-300',
    'text-base-content', 'border-base-300',
    // 确保所有 DaisyUI 主题相关的类都被包含
    { pattern: /^(badge|btn|bg|text|border)-(primary|secondary|accent|neutral|base|info|success|warning|error)/ },
    { pattern: /^(bg|text|border)-base-(100|200|300|content)/ }
  ],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ["light", "dark"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
};
