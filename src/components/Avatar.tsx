import type { ExecutorKey } from '../data/mock'
import { LinageLogo } from './Icons'

/** Two actors exist in Linage: you ('me') and the agent ('agent'). */
export function Avatar({ user, size = 'md' }: { user: ExecutorKey | string; size?: 'sm' | 'md' }) {
  const cls = `avatar${size === 'sm' ? ' sm' : ''}`
  if (user === 'me') {
    return (
      <span className={cls} style={{ background: 'var(--accent)' }}>
        K
      </span>
    )
  }
  return (
    <span className={`${cls} bot`}>
      <LinageLogo size={size === 'sm' ? 8 : 9} />
    </span>
  )
}

export function BotAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`avatar bot${size === 'sm' ? ' sm' : ''}`}>
      <LinageLogo size={size === 'sm' ? 8 : 9} />
    </span>
  )
}
