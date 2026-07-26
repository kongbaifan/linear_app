// Pulse: a real personal weekly report, computed from the store — issues,
// agent runs, chats. Replaces what used to be a decorative sidebar button.
import type { Issue } from '../data/mock'
import type { AgentTask, ChatThread } from '../store'
import { useI18n } from '../i18n'
import { BotAvatar } from './Avatar'
import { GitBranch, StatusDone } from './Icons'

const WEEK_MS = 7 * 86_400_000

export default function PulseView({
  issues,
  agentTasks,
  chats,
  onOpenIssue,
  onOpenTask,
}: {
  issues: Issue[]
  agentTasks: AgentTask[]
  chats: ChatThread[]
  onOpenIssue: (id: string) => void
  onOpenTask: (id: string) => void
}) {
  const { t, locale } = useI18n()
  const cutoff = Date.now() - WEEK_MS

  const created = issues.filter((i) => i.createdAt >= cutoff).length
  const doneIssues = issues.filter((i) => i.status === 'done').length
  const runs = agentTasks.filter((a) => a.createdAt >= cutoff).length
  const prs = agentTasks.filter((a) => a.prUrl).length
  const revisions = agentTasks.reduce((n, a) => n + (a.revisions?.length ?? 0), 0)
  const chatMsgs = chats.reduce(
    (n, c) => n + c.messages.filter((m) => m.time >= cutoff).length,
    0,
  )
  const needsReview = agentTasks.filter((a) => a.status === 'needsReview')
  const recentDone = agentTasks
    .filter((a) => a.status === 'done')
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 5)

  const stats: { label: string; value: number }[] = [
    { label: t('pulse.created'), value: created },
    { label: t('pulse.runs'), value: runs },
    { label: t('pulse.chatMsgs'), value: chatMsgs },
    { label: t('pulse.revisions'), value: revisions },
    { label: t('pulse.prs'), value: prs },
    { label: t('pulse.doneIssues'), value: doneIssues },
  ]

  const fmtTime = (ts?: number) =>
    ts
      ? new Date(ts).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('nav.pulse')}</span>
          <span className="pulse-range">{t('pulse.range')}</span>
        </div>
      </header>
      <div className="pulse-page">
        <div className="pulse-grid">
          {stats.map((s) => (
            <div key={s.label} className="stat-card">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <section className="pulse-section">
          <h3 className="settings-section-title">{t('pulse.review')}</h3>
          {needsReview.length === 0 && (
            <p className="pulse-empty">{t('pulse.reviewEmpty')}</p>
          )}
          {needsReview.map((a) => (
            <button key={a.id} className="pulse-row" onClick={() => onOpenTask(a.id)}>
              <BotAvatar size="sm" />
              <span className="pulse-row-title">{a.title}</span>
              <span className="issue-id" style={{ width: 'auto' }}>
                {a.issueId}
              </span>
              <span className="pulse-row-time">{fmtTime(a.finishedAt)}</span>
            </button>
          ))}
        </section>

        <section className="pulse-section">
          <h3 className="settings-section-title">{t('pulse.recent')}</h3>
          {recentDone.length === 0 && <p className="pulse-empty">{t('pulse.recentEmpty')}</p>}
          {recentDone.map((a) => (
            <button key={a.id} className="pulse-row" onClick={() => onOpenIssue(a.issueId)}>
              <span style={{ color: 'var(--accent-text)', display: 'inline-flex' }}>
                {a.prUrl ? <GitBranch size={14} /> : <StatusDone size={14} />}
              </span>
              <span className="pulse-row-title">{a.title}</span>
              <span className="issue-id" style={{ width: 'auto' }}>
                {a.issueId}
              </span>
              <span className="pulse-row-time">{fmtTime(a.finishedAt)}</span>
            </button>
          ))}
        </section>
      </div>
    </>
  )
}
