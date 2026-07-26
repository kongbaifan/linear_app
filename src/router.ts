// Zero-dependency hash router. Syncs a typed View with location.hash so
// browser back/forward work and every screen is deep-linkable.
import { useCallback, useEffect, useState } from 'react'

export type View =
  | { type: 'list'; board?: boolean }
  | { type: 'issue'; id: string }
  | { type: 'diff'; id: string }
  | { type: 'inbox' }
  | { type: 'projects' }

export const DEFAULT_VIEW: View = { type: 'issue', id: 'ENG-2703' }

export function viewToHash(v: View): string {
  switch (v.type) {
    case 'list':
      return v.board ? '#/issues/board' : '#/issues'
    case 'issue':
      return `#/issue/${v.id}`
    case 'diff':
      return `#/review/${v.id}`
    case 'inbox':
      return '#/inbox'
    case 'projects':
      return '#/projects'
  }
}

export function parseHash(hash: string): View {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [a, b] = parts
  switch (a) {
    case 'issues':
      return { type: 'list', board: b === 'board' }
    case 'issue':
      return b ? { type: 'issue', id: b } : { type: 'list' }
    case 'review':
      return { type: 'diff', id: b ?? 'ENG-2498' }
    case 'inbox':
      return { type: 'inbox' }
    case 'projects':
      return { type: 'projects' }
    default:
      return DEFAULT_VIEW
  }
}

export function useHashRoute(): [View, (v: View) => void] {
  const [view, setViewState] = useState<View>(() =>
    window.location.hash ? parseHash(window.location.hash) : DEFAULT_VIEW,
  )

  useEffect(() => {
    const onHash = () => setViewState(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((v: View) => {
    const hash = viewToHash(v)
    if (window.location.hash === hash) {
      setViewState(v)
    } else {
      window.location.hash = hash // triggers hashchange → state update
    }
  }, [])

  return [view, navigate]
}
