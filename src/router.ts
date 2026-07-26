// Zero-dependency hash router. Syncs a typed View with location.hash so
// browser back/forward work and every screen is deep-linkable.
import { useCallback, useEffect, useState } from 'react'

export type View =
  | { type: 'list'; board?: boolean }
  | { type: 'issue'; id: string }
  | { type: 'reviews' }
  | { type: 'inbox' }
  | { type: 'projects' }
  | { type: 'agents' }
  | { type: 'task'; id: string }
  | { type: 'settings' }

export const DEFAULT_VIEW: View = { type: 'inbox' }

export function viewToHash(v: View): string {
  switch (v.type) {
    case 'list':
      return v.board ? '#/issues/board' : '#/issues'
    case 'issue':
      return `#/issue/${v.id}`
    case 'reviews':
      return '#/reviews'
    case 'inbox':
      return '#/inbox'
    case 'projects':
      return '#/projects'
    case 'agents':
      return '#/agents'
    case 'task':
      return `#/task/${v.id}`
    case 'settings':
      return '#/settings'
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
    case 'reviews':
      return { type: 'reviews' }
    case 'inbox':
      return { type: 'inbox' }
    case 'projects':
      return { type: 'projects' }
    case 'agents':
      return { type: 'agents' }
    case 'task':
      return b ? { type: 'task', id: b } : { type: 'agents' }
    case 'settings':
      return { type: 'settings' }
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
