import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('arena-theme', theme) } catch (_) {}
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
