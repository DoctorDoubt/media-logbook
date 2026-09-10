import { useState } from 'react'

const AUTH_TOKEN_KEY = 'jefflog-auth-token'

interface PasswordModalProps {
  onUnlock: () => void
}

export function PasswordModal({ onUnlock }: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/check-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (data.success && data.token) {
        // Store JWT token in sessionStorage (cleared on browser close)
        sessionStorage.setItem(AUTH_TOKEN_KEY, data.token)
        onUnlock()
      } else {
        setError(data.error || 'Incorrect password')
        setPassword('')
      }
    } catch {
      setError('Failed to verify password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg">
      <div className="max-w-md w-full mx-4 p-8 border border-border bg-panel shadow-lg">
        <h1 className="text-2xl font-bold text-text mb-2 text-center">🔒 Locked</h1>
        <p className="text-muted text-sm text-center mb-6">Enter password to access Jeff Log</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-4 py-3 border border-border bg-bg text-text placeholder:text-dim focus:outline-none focus:border-muted"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-dropped text-xs text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full px-4 py-3 bg-text text-bg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-dim">
          <p>Session-based access • Refresh page to re-lock</p>
        </div>
      </div>
    </div>
  )
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function clearAuthToken(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY)
}
