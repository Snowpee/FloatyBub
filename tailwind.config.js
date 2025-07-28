/** @type {import('tailwindcss').Config} */

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: "all", // 启用所有35个内置主题
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
};
