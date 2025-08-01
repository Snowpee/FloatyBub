// Tailwind CSS 4 + DaisyUI 5 configuration is now handled in CSS files
// See src/index.css for theme and plugin configuration
module.exports = {
  theme: {
    extend: {
      colors: {
        'base-light': 'oklch(var(--color-base-light))',
      }
    }
  }
}