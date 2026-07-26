import type { Notification, NotificationKind } from '../data/mock'
import { useI18n, type MessageKey } from '../i18n'
import { BotAvatar } from './Avatar'
import { GitBranch, LinageLogo, Sparkle, StatusDone } from './Icons'

const kindLabel: Record<NotificationKind, MessageKey> = {
  welcome: 'inbox.kind.welcome',
  needsReview: 'inbox.kind.needsReview',
  applied: 'inbox.kind.applied',
  prCreated: 'inbox.kind.prCreated',
  failed: 'inbox.kind.failed',
}

function kindIcon(kind: NotificationKind) {
  switch (kind) {
    case 'welcome':
      return <LinageLogo size={13} />
    case 'needsReview':
      return <BotAvatar size="sm" />
    case 'applied':
      return <StatusDone size={14} />
    case 'prCreated':
      return <GitBranch size={14} />
    case 'failed':
      return <Sparkle size={13} />
  }
}

function relTime(ts: number, locale: string): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  const zh = locale === 'zh'
  if (s < 60) return zh ? '刚刚' : 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function InboxView({
  items,
  onRead,
  onReadAll,
  onOpenTask,
  onOpenIssue,
  onOpenSettings,
}: {
  items: Notification[]
  onRead: (id: string) => void
  onReadAll: () => void
  onOpenTask: (taskId: string) => void
  onOpenIssue: (issueId: string) => void
  onOpenSettings: () => void
}) {
  const { t, locale } = useI18n()
  const unread = items.filter((i) => i.unread).length

  const open = (n: Notification) => {
    onRead(n.id)
    if (n.kind === 'welcome') onOpenSettings()
    else if (n.taskId) onOpenTask(n.taskId)
    else if (n.issueId) onOpenIssue(n.issueId)
  }

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('inbox.title')}</span>
          {unread > 0 && <span className="unread-badge">{unread}</span>}
        </div>
        <div className="panel-header-right">
          <button className="btn sm" onClick={onReadAll}>
            {t('inbox.markAllRead')}
          </button>
        </div>
      </header>
      <div className="inbox-list">
        {items.length === 0 && <div className="agents-empty">{t('inbox.empty')}</div>}
        {items.map((n) => (
          <button key={n.id} className={`inbox-row${n.unread ? ' unread' : ''}`} onClick={() => open(n)}>
            <span className="inbox-dot" />
            <span className="inbox-icon">{kindIcon(n.kind)}</span>
            <span className="inbox-main">
              <span className="inbox-title">
                {n.title}
                {n.issueId && (
                  <span className="issue-id" style={{ width: 'auto', marginLeft: 8 }}>
                    {n.issueId}
                  </span>
                )}
              </span>
              <span className="inbox-event">
                {t(kindLabel[n.kind])}
                {n.kind === 'failed' && n.detail ? ` — ${n.detail}` : ''}
              </span>
            </span>
            {n.unread && (
              <span
                className="inbox-quick"
                role="button"
                title={t('inbox.markRead')}
                onClick={(e) => {
                  e.stopPropagation()
                  onRead(n.id)
                }}
              >
                <StatusDone size={14} />
              </span>
            )}
            <span className="inbox-time">{relTime(n.time, locale)}</span>
          </button>
        ))}
      </div>
    </>
  )
}
