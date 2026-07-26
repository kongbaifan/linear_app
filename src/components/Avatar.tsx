import { users } from '../data/mock'
import { LinearLogo } from './Icons'

export function Avatar({ user, size = 'md' }: { user: string; size?: 'sm' | 'md' }) {
  const u = users[user]
  const cls = `avatar${size === 'sm' ? ' sm' : ''}`
  if (!u) {
    return (
      <span className={`${cls} bot`}>
        <LinearLogo size={size === 'sm' ? 8 : 9} />
      </span>
    )
  }
  return (
    <span className={cls} style={{ background: u.color }}>
      {u.name[0]}
    </span>
  )
}

export function BotAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`avatar bot${size === 'sm' ? ' sm' : ''}`}>
      <LinearLogo size={size === 'sm' ? 8 : 9} />
    </span>
  )
}
