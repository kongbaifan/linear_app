import type { Notification } from '../data/mock'
import { Avatar, BotAvatar } from './Avatar'
import { GitBranch, Sparkle, StatusDone, StatusInProgress } from './Icons'
import { useI18n } from '../i18n'

function kindIcon(n: Notification) {
  if (n.actor) return <Avatar user={n.actor} />
  switch (n.kind) {
    case 'pr':
      return <GitBranch size={14} />
    case 'label':
      return <Sparkle size={14} />
    case 'status':
      return n.issueId === 'ENG-2471' ? <StatusDone size={14} /> : <StatusInProgress size={14} />
    default:
      return <BotAvatar size="sm" />
  }
}

export default function InboxView({
  items,
  onRead,
  onReadAll,
  onOpenIssue,
}: {
  items: Notification[]
  onRead: (id: string) => void
  onReadAll: () => void
  onOpenIssue: (id: string) => void
}) {
  const { t } = useI18n()
  const unread = items.filter((i) => i.unread).length

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
        {items.map((n) => (
          <button
            key={n.id}
            className={`inbox-row${n.unread ? ' unread' : ''}`}
            onClick={() => {
              onRead(n.id)
              onOpenIssue(n.issueId)
            }}
          >
            <span className="inbox-dot" />
            <span className="inbox-icon">{kindIcon(n)}</span>
            <span className="inbox-main">
              <span className="inbox-title">
                {n.issueTitle}
                <span className="issue-id" style={{ width: 'auto', marginLeft: 8 }}>
                  {n.issueId}
                </span>
              </span>
              <span className="inbox-event">{n.event}</span>
            </span>
            <span className="inbox-time">{n.time}</span>
          </button>
        ))}
      </div>
    </>
  )
}
