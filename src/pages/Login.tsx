import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Account created. If email confirmation is on, check your inbox — otherwise you are signed in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-2xl font-bold tracking-tight text-slate-100">
            Level <span className="text-accent">Up</span>
          </p>
          <p className="text-sm text-slate-500 mt-1.5">Your personal operating system for the week.</p>
        </div>

        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <p className="text-xs text-hi">{error}</p>}
          {info && <p className="text-xs text-lo">{info}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Please wait…' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode((m) => (m === 'sign_in' ? 'sign_up' : 'sign_in'))
            setError(null)
            setInfo(null)
          }}
          className="btn-quiet w-full mt-4 text-xs"
        >
          {mode === 'sign_in' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
