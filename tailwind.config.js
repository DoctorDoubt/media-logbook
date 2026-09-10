/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'text-movie', 'text-tv', 'text-game', 'text-comic',
    'text-planned', 'text-inprogress', 'text-completed', 'text-paused', 'text-dropped', 'text-replaying',
    'border-movie', 'border-tv', 'border-game', 'border-comic',
    'border-planned', 'border-inprogress', 'border-completed', 'border-paused', 'border-dropped', 'border-replaying',
    'bg-movie', 'bg-tv', 'bg-game', 'bg-comic',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        panel: 'var(--color-panel)',
        border: 'var(--color-border)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        dim: 'var(--color-dim)',
        label: 'var(--color-label)',
        movie: 'var(--color-movie)',
        tv: 'var(--color-tv)',
        game: 'var(--color-game)',
        comic: 'var(--color-comic)',
        planned: 'var(--color-planned)',
        inprogress: 'var(--color-inprogress)',
        completed: 'var(--color-completed)',
        paused: 'var(--color-paused)',
        dropped: 'var(--color-dropped)',
        replaying: 'var(--color-replaying)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
