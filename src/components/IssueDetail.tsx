import type { Issue, PriorityKey, StatusKey } from '../data/mock'
import { eng2703Activity, users, type ActivityItem, type BodyPart, type EventPart } from '../data/mock'
import { Avatar, BotAvatar } from './Avatar'
import { Dropdown } from './Dropdown'
import { allLabels, priorityMeta, priorityOrder, statusMeta, statusOrder } from './meta'
import { useI18n } from '../i18n'
import {
  ChevronDown,
  ChevronUp,
  CopyIcon,
  Dots,
  GitBranch,
  LinkIcon,
  Paperclip,
  Screenful,
  SlackMark,
  Sparkle,
  Star,
  StatusInProgress,
  SubIssueArrow,
  ArrowUp,
  LinearLogo,
} from './Icons'

function EventText({ parts, time }: { parts: EventPart[]; time: string }) {
  return (
    <span className="event-text">
      {parts.map((p, i) =>
        p.t === 'strong' ? (
          <b key={i}>{p.s}</b>
        ) : p.t === 'chip' ? (
          <span key={i} className="chip">
            <span className="chip-dot" style={{ background: p.color }} />
            {p.s}
          </span>
        ) : (
          <span key={i}>{p.s}</span>
        ),
      )}
      <span className="event-time">{time}</span>
    </span>
  )
}

function CommentBody({ parts }: { parts: BodyPart[] }) {
  return (
    <div className="comment-body">
      {parts.map((p, i) =>
        p.t === 'mention' ? (
          <span key={i} className="mention">
            {p.s}
          </span>
        ) : (
          <span key={i}>{p.s}</span>
        ),
      )}
    </div>
  )
}

function eventIcon(icon: string) {
  switch (icon) {
    case 'bot':
      return <BotAvatar size="sm" />
    case 'triage':
      return <Sparkle size={13} />
    case 'link':
      return <BotAvatar size="sm" />
    case 'sparkle':
      return <Sparkle size={13} />
    case 'status':
      return <StatusInProgress size={13} />
    default:
      return null
  }
}

function ActivityFeed({ items, onOpenDiff }: { items: ActivityItem[]; onOpenDiff: () => void }) {
  return (
    <div className="activity">
      {items.map((item, i) => {
        if (item.kind === 'event') {
          return (
            <div key={i} className="activity-event">
              <span className="event-icon">{eventIcon(item.icon)}</span>
              <EventText parts={item.html} time={item.time} />
            </div>
          )
        }
        if (item.kind === 'comments') {
          return (
            <div key={i} className="comment-card">
              {item.comments.map((c, j) => (
                <div key={j} className={`comment${c.reply ? ' reply' : ''}`}>
                  <div className="comment-head">
                    <Avatar user={c.author} />
                    <span className="comment-author">{c.author}</span>
                    <span className="comment-time">· {c.time}</span>
                  </div>
                  <CommentBody parts={c.body} />
                </div>
              ))}
            </div>
          )
        }
        // PR attachment card
        return (
          <div key={i} className="activity-event" style={{ display: 'block' }}>
            <div className="activity-event" style={{ padding: 0 }}>
              <span className="event-icon">
                <Sparkle size={13} />
              </span>
              <span className="event-text">
                <b>Changed 2 files</b> Draft PR awaiting your review
                <span className="event-time">2 min ago</span>
              </span>
            </div>
            <div className="pr-card" onClick={onOpenDiff}>
              <div className="pr-card-info">
                <div className="pr-card-line1">
                  Changed 2 files <span className="added">+4</span> <span className="removed">-4</span>
                </div>
                <div className="pr-card-line2">
                  <GitBranch size={13} />
                  Draft Update homepage H1
                </div>
                <div className="pr-card-branch">master ← ride/drv-899-update-homepage-h1-65a6</div>
              </div>
              <button className="btn">
                <Screenful size={13} />
                Preview
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function IssueDetail({
  issue,
  onOpenDiff,
  onUpdate,
}: {
  issue: Issue
  onOpenDiff: (id: string) => void
  onUpdate: (patch: Partial<Issue>) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{issue.title}</span>
          <span className="star">
            <Star size={12} />
          </span>
          <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
            <Dots size={13} />
          </span>
        </div>
        <div className="panel-header-right">
          <span className="pager">
            <b>02</b> / 145
          </span>
          <button className="icon-btn">
            <ChevronUp size={12} />
          </button>
          <button className="icon-btn">
            <ChevronDown size={12} />
          </button>
        </div>
      </header>

      <div className="issue-layout">
        <div className="issue-content">
          <div className="issue-content-inner">
            <h1 className="issue-title">{issue.title}</h1>
            <p className="issue-description">
              Render UI before <span className="code-chip">vehicle_state</span> sync when minimum
              required state is present, instead of blocking on full refresh during iOS startup.
            </p>

            <h2 className="section-heading">{t('issue.activity')}</h2>
            <ActivityFeed items={eng2703Activity} onOpenDiff={() => onOpenDiff('ENG-2498')} />

            <div className="composer">
              <span>{t('issue.leaveComment')}</span>
              <span className="composer-actions">
                <button className="icon-btn">
                  <Paperclip size={13} />
                </button>
                <button className="send-btn">
                  <ArrowUp size={12} />
                </button>
              </span>
            </div>
          </div>
        </div>

        <aside className="props-panel">
          <div className="props-panel-header">
            <span className="props-id">{issue.id}</span>
            <span className="props-actions">
              <button className="icon-btn">
                <LinkIcon />
              </button>
              <button className="icon-btn">
                <CopyIcon />
              </button>
              <button className="icon-btn">
                <GitBranch />
              </button>
            </span>
          </div>

          <Dropdown
            trigger={() => (
              <button className="prop-row">
                {statusMeta[issue.status].icon()}
                {t(`status.${issue.status}`)}
              </button>
            )}
            header={t('issue.changeStatus')}
            options={statusOrder.map((s) => ({
              key: s,
              label: t(`status.${s}`),
              icon: statusMeta[s].icon(13),
              checked: s === issue.status,
            }))}
            onSelect={(k) => onUpdate({ status: k as StatusKey })}
          />
          <Dropdown
            trigger={() => (
              <button className="prop-row">
                {priorityMeta[issue.priority].icon()}
                {t(`priority.${issue.priority}`)}
              </button>
            )}
            header={t('issue.changePriority')}
            options={priorityOrder.map((p) => ({
              key: p,
              label: t(`priority.${p}`),
              icon: priorityMeta[p].icon(13),
              checked: p === issue.priority,
            }))}
            onSelect={(k) => onUpdate({ priority: k as PriorityKey })}
          />
          <Dropdown
            trigger={() => (
              <button className="prop-row">
                {issue.assignee ? (
                  <Avatar user={issue.assignee} />
                ) : (
                  <span
                    className="avatar"
                    style={{ background: 'transparent', border: '1px dashed var(--border-strong)' }}
                  />
                )}
                {issue.assignee ?? t('issue.unassigned')}
              </button>
            )}
            header={t('issue.assignTo')}
            options={[
              { key: '', label: t('issue.noAssignee'), checked: !issue.assignee },
              ...Object.keys(users).map((u) => ({
                key: u,
                label: users[u].name,
                icon: <Avatar user={u} size="sm" />,
                checked: issue.assignee === u,
              })),
            ]}
            onSelect={(k) => onUpdate({ assignee: k || undefined })}
          />
          <button className="prop-row sub">
            <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
              <SubIssueArrow size={12} />
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LinearLogo size={11} />
              Linear
            </span>
          </button>

          <div className="prop-label">{t('issue.labels')}</div>
          <div className="label-chips">
            {issue.labels.map((l) => (
              <span key={l.name} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', borderRadius: 20, padding: '0 8px', height: 22, fontSize: 12, color: 'var(--text-2)' }}>
                <span className="chip-dot" style={{ background: l.color }} />
                {l.name}
              </span>
            ))}
            <Dropdown
              closeOnSelect={false}
              trigger={() => (
                <button
                  className="chip add-label"
                  style={{ display: 'inline-flex', alignItems: 'center', border: '1px dashed var(--border-strong)', borderRadius: 20, padding: '0 8px', height: 22, fontSize: 12, color: 'var(--text-3)' }}
                >
                  +
                </button>
              )}
              header={t('issue.addLabels')}
              options={allLabels.map((l) => ({
                key: l.name,
                label: l.name,
                icon: <span className="chip-dot" style={{ background: l.color }} />,
                checked: issue.labels.some((x) => x.name === l.name),
              }))}
              onSelect={(k) =>
                onUpdate({
                  labels: issue.labels.some((x) => x.name === k)
                    ? issue.labels.filter((x) => x.name !== k)
                    : [...issue.labels, allLabels.find((x) => x.name === k)!],
                })
              }
            />
          </div>

          <div className="prop-label">{t('issue.createdVia')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 12.5 }}>
            <SlackMark size={13} />
            Slack
          </div>
        </aside>
      </div>
    </>
  )
}
