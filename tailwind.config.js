/** @type {import('tailwindcss').Config} */

module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    // DaisyUI 主题相关类的模式匹配（覆盖所有组件和颜色变体）
    { pattern: /^(badge|btn|bg|text|border)-(primary|secondary|accent|neutral|base|info|success|warning|error)/ },
    { pattern: /^(bg|text|border)-base-(100|200|300|content)/ }
  ],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [
    require('daisyui')({
      themes: ['light', 'dark', 'cupcake', 'floaty']
    })
  ]
};
