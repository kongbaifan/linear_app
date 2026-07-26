import { useState } from 'react'
import type { ExecutorKey, Issue, PriorityKey, Project, StatusKey } from '../data/mock'
import type { AgentTask } from '../store'
import { Avatar, BotAvatar } from './Avatar'
import { Dropdown } from './Dropdown'
import { allLabels, executorOrder, priorityMeta, priorityOrder, statusMeta, statusOrder } from './meta'
import { useI18n, type MessageKey } from '../i18n'
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CopyIcon,
  Dots,
  GitBranch,
  LinkIcon,
  LinageLogo,
  Paperclip,
  Projects as ProjectsIcon,
  Star,
} from './Icons'

const executorLabel: Record<ExecutorKey, MessageKey> = {
  me: 'executor.me',
  agent: 'executor.agent',
}

interface ActivityEvent {
  icon: React.ReactNode
  textKey?: MessageKey
  noteText?: string
  extra?: string
  time: number
  taskId?: string
}

function buildActivity(issue: Issue, tasks: AgentTask[]): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      icon: <Avatar user="me" size="sm" />,
      textKey: 'activity.created',
      time: issue.createdAt,
    },
  ]
  for (const note of issue.notes ?? []) {
    events.push({ icon: <Avatar user="me" size="sm" />, noteText: note.text, time: note.time })
  }
  for (const task of [...tasks].reverse()) {
    events.push({
      icon: <BotAvatar size="sm" />,
      textKey: 'activity.delegated',
      extra: task.model,
      time: task.createdAt,
      taskId: task.id,
    })
    if (task.status === 'needsReview' || task.status === 'done' || task.status === 'applying') {
      events.push({
        icon: <BotAvatar size="sm" />,
        textKey: 'activity.finished',
        extra: task.summary,
        time: task.finishedAt ?? task.createdAt,
        taskId: task.id,
      })
    }
    if (task.status === 'done') {
      events.push({
        icon: <Avatar user="me" size="sm" />,
        textKey: task.prUrl ? 'activity.prCreated' : 'activity.approved',
        extra: task.prUrl,
        time: task.finishedAt ?? task.createdAt,
        taskId: task.id,
      })
    }
    if (task.status === 'failed') {
      events.push({
        icon: <BotAvatar size="sm" />,
        textKey: 'activity.failed',
        extra: task.summary,
        time: task.finishedAt ?? task.createdAt,
        taskId: task.id,
      })
    }
  }
  return events.sort((a, b) => a.time - b.time)
}

export default function IssueDetail({
  issue,
  issueTasks,
  projects,
  onUpdate,
  agentTask,
  onDelegate,
  onViewAgent,
  onReviewTask,
}: {
  issue: Issue
  issueTasks: AgentTask[]
  projects: Project[]
  onUpdate: (patch: Partial<Issue>) => void
  agentTask?: AgentTask
  onDelegate: (issue: Issue) => void
  onViewAgent: () => void
  onReviewTask: (taskId: string) => void
}) {
  const { t, locale } = useI18n()
  const [note, setNote] = useState('')
  const activity = buildActivity(issue, issueTasks)

  const submitNote = () => {
    const text = note.trim()
    if (!text) return
    onUpdate({
      notes: [...(issue.notes ?? []), { id: `note-${Date.now()}`, text, time: Date.now() }],
    })
    setNote('')
  }
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  const project = projects.find((p) => p.id === issue.project)

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{issue.title}</span>
          {issue.sample && <span className="sample-badge">{t('issue.sample')}</span>}
          <span className="star">
            <Star size={12} />
          </span>
          <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
            <Dots size={13} />
          </span>
        </div>
        <div className="panel-header-right">
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
            {issue.description ? (
              <p className="issue-description">{issue.description}</p>
            ) : (
              <p className="issue-description" style={{ color: 'var(--text-3)' }}>
                {t('issue.noDescription')}
              </p>
            )}

            <h2 className="section-heading">{t('issue.activity')}</h2>
            <div className="activity">
              {activity.map((ev, i) => (
                <div key={i} className="activity-event">
                  <span className="event-icon">{ev.icon}</span>
                  <span className="event-text">
                    {ev.noteText ? <b>{ev.noteText}</b> : t(ev.textKey!)}
                    {ev.extra && ev.textKey === 'activity.delegated' && (
                      <span className="model-badge" style={{ marginLeft: 6 }}>
                        {ev.extra}
                      </span>
                    )}
                    {ev.extra && ev.textKey === 'activity.prCreated' && (
                      <>
                        {' '}
                        <a href={ev.extra} target="_blank" rel="noreferrer" className="mention">
                          PR ↗
                        </a>
                      </>
                    )}
                    {ev.extra &&
                      (ev.textKey === 'activity.finished' || ev.textKey === 'activity.failed') && (
                        <span style={{ color: 'var(--text-3)' }}> — {ev.extra}</span>
                      )}
                    {ev.taskId &&
                      (ev.textKey === 'activity.finished') && (
                        <>
                          {' '}
                          <button className="mention" onClick={() => onReviewTask(ev.taskId!)}>
                            {t('agents.review')}
                          </button>
                        </>
                      )}
                    <span className="event-time">{fmtTime(ev.time)}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="composer slim">
              <input
                className="composer-input"
                placeholder={t('issue.leaveComment')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitNote()}
              />
              <span className="composer-actions">
                <button className="icon-btn" title="attach">
                  <Paperclip size={13} />
                </button>
                <button className="send-btn" onClick={submitNote}>
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
                <Avatar user={issue.executor} />
                {t(executorLabel[issue.executor])}
              </button>
            )}
            header={t('issue.executor')}
            options={executorOrder.map((e) => ({
              key: e,
              label: t(executorLabel[e]),
              icon: <Avatar user={e} size="sm" />,
              checked: issue.executor === e,
            }))}
            onSelect={(k) => onUpdate({ executor: k as ExecutorKey })}
          />
          <Dropdown
            trigger={() => (
              <button className="prop-row">
                <span style={{ color: project ? project.color : 'var(--text-3)', display: 'inline-flex' }}>
                  <ProjectsIcon size={14} />
                </span>
                {project ? project.name : t('issue.noProject')}
              </button>
            )}
            header={t('issue.setProject')}
            options={[
              { key: '', label: t('issue.noProject'), checked: !issue.project },
              ...projects.map((p) => ({
                key: p.id,
                label: p.name,
                icon: <span className="chip-dot" style={{ background: p.color }} />,
                checked: issue.project === p.id,
              })),
            ]}
            onSelect={(k) => onUpdate({ project: k || undefined })}
          />

          <div className="prop-label">Agent</div>
          {!agentTask && (
            <button className="btn sm delegate-btn" onClick={() => onDelegate(issue)}>
              <LinageLogo size={11} />
              {t('agents.delegate')}
            </button>
          )}
          {agentTask && (agentTask.status === 'queued' || agentTask.status === 'working') && (
            <button className="btn sm delegate-btn working" onClick={onViewAgent}>
              <span className="spinner" />
              {t('agents.working')}
            </button>
          )}
          {agentTask && (agentTask.status === 'needsReview' || agentTask.status === 'applying') && (
            <button className="btn sm delegate-btn review" onClick={() => onReviewTask(agentTask.id)}>
              <LinageLogo size={11} />
              {t('agents.review')}
            </button>
          )}

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
        </aside>
      </div>
    </>
  )
}
