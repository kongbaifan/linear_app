import { useState } from 'react'
import type { AgentTask, AgentTaskStatus } from '../store'
import { useI18n, type MessageKey } from '../i18n'
import { BotAvatar } from './Avatar'
import { ChevronDown, Eye, StatusDone } from './Icons'

const statusKey: Record<AgentTaskStatus, MessageKey> = {
  queued: 'agents.status.queued',
  working: 'agents.status.working',
  needsReview: 'agents.status.needsReview',
  applying: 'agents.status.applying',
  done: 'agents.status.done',
  failed: 'agents.status.failed',
}

const statusColor: Record<AgentTaskStatus, string> = {
  queued: 'var(--text-3)',
  working: 'var(--yellow)',
  needsReview: 'var(--accent-text)',
  applying: 'var(--yellow)',
  done: 'var(--green)',
  failed: 'var(--red)',
}

function Spinner() {
  return <span className="spinner" />
}

function elapsed(t: AgentTask): string {
  const end = t.finishedAt ?? Date.now()
  const s = Math.max(1, Math.round((end - t.createdAt) / 1000))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function AgentTasksView({
  tasks,
  reviewsOnly = false,
  onOpenIssue,
  onOpenTask,
  onApprove,
  onOpenSettings,
}: {
  tasks: AgentTask[]
  reviewsOnly?: boolean
  onOpenIssue: (id: string) => void
  onOpenTask: (id: string) => void
  onApprove: (id: string) => void
  onOpenSettings: () => void
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState<string | null>(null)
  const visible = reviewsOnly
    ? tasks.filter((x) => x.status === 'needsReview' || x.status === 'applying')
    : tasks

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{reviewsOnly ? t('nav.reviews') : t('agents.title')}</span>
        </div>
        <div className="panel-header-right">
          <button className="btn sm" onClick={onOpenSettings}>
            {t('agents.settings')}
          </button>
        </div>
      </header>
      <div className="agent-tasks">
        {visible.length === 0 && (
          <div className="agents-empty">{reviewsOnly ? t('reviews.empty') : t('agents.empty')}</div>
        )}
        {visible.map((task) => {
          const isOpen = expanded === task.id
          const active = task.status === 'queued' || task.status === 'working'
          return (
            <div key={task.id} className="agent-task">
              <button
                className="agent-task-row"
                onClick={() => setExpanded(isOpen ? null : task.id)}
              >
                <span className="agent-task-status" style={{ color: statusColor[task.status] }}>
                  {task.status === 'working' || task.status === 'applying' ? (
                    <Spinner />
                  ) : task.status === 'done' ? (
                    <StatusDone size={13} />
                  ) : (
                    <span className="chip-dot" style={{ background: statusColor[task.status] }} />
                  )}
                  {t(statusKey[task.status])}
                </span>
                <BotAvatar size="sm" />
                <span
                  className="issue-id"
                  style={{ width: 'auto', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenIssue(task.issueId)
                  }}
                >
                  {task.issueId}
                </span>
                <span className="agent-task-title">{task.title}</span>
                <span className="issue-row-spacer" />
                {task.repo && <span className="model-badge repo-badge">{task.repo}</span>}
                <span className="model-badge">{task.model}</span>
                <span className="agent-task-time">{elapsed(task)}</span>
                {task.prUrl && (
                  <a
                    className="btn sm"
                    href={task.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    PR ↗
                  </a>
                )}
                {task.status === 'needsReview' && (
                  <>
                    <button
                      className="btn sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenTask(task.id)
                      }}
                    >
                      <Eye size={12} />
                      {t('agents.review')}
                    </button>
                    <button
                      className="btn sm primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        onApprove(task.id)
                      }}
                    >
                      ✓
                    </button>
                  </>
                )}
                <span className={`agent-chevron${isOpen ? ' open' : ''}`}>
                  <ChevronDown size={11} />
                </span>
              </button>
              {(isOpen || active) && task.steps.length > 0 && (
                <div className="agent-task-steps">
                  {(isOpen ? task.steps : task.steps.slice(-1)).map((s, i) => (
                    <div key={i} className="agent-worked-step">
                      {s}
                    </div>
                  ))}
                  {task.status === 'working' && <div className="agent-worked-step pulse">…</div>}
                </div>
              )}
              {isOpen && task.summary && <div className="agent-task-summary">{task.summary}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}
