import { useMemo } from 'react'
import type { AgentTask } from '../store'
import { renderDiff } from '../agent/diff'
import { useI18n } from '../i18n'
import { BotAvatar } from './Avatar'
import { FileIcon, GitBranch, StatusDone } from './Icons'

function DiffCard({ file }: { file: ReturnType<typeof renderDiff> }) {
  return (
    <div className="diff-file">
      <div className="diff-file-header">
        <span className="file-icon">
          <FileIcon size={13} />
        </span>
        <span className="diff-file-name">{file.name}</span>
        <span className="diff-file-path">{file.path}</span>
        <span className="diff-file-stats">
          <span className="diff-stat-add">+{file.added}</span>
          <span className="diff-stat-del">-{file.removed}</span>
        </span>
      </div>
      <div className="diff-code">
        {file.lines.map((line, i) =>
          line.kind === 'gap' ? (
            <div key={i} className="diff-line gap">
              <span className="gutter" />
              <span className="sign" />
              <span className="code">⋯</span>
            </div>
          ) : (
            <div
              key={i}
              className={`diff-line ${line.kind === 'add' ? 'add' : line.kind === 'del' ? 'del' : ''}`}
            >
              <span className="gutter">{line.no ?? ''}</span>
              <span className="sign">{line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}</span>
              <span className="code" dangerouslySetInnerHTML={{ __html: line.html }} />
            </div>
          ),
        )}
      </div>
    </div>
  )
}

export default function TaskDiffView({
  task,
  onBack,
  onApprove,
  onOpenIssue,
}: {
  task: AgentTask
  onBack: () => void
  onApprove: () => void
  onOpenIssue: (id: string) => void
}) {
  const { t } = useI18n()
  const files = useMemo(
    () => (task.changes ?? []).map((c) => renderDiff(c.path, c.before, c.after)),
    [task.changes],
  )
  const added = files.reduce((n, f) => n + f.added, 0)
  const removed = files.reduce((n, f) => n + f.removed, 0)

  return (
    <>
      <header className="diff-header">
        <div className="diff-header-left">
          <BotAvatar size="sm" />
          <button className="issue-ref" onClick={() => onOpenIssue(task.issueId)}>
            {task.issueId}
          </button>
          <span className="crumb-sep">›</span>
          <span className="branch-name">
            <GitBranch size={13} />
            {task.title}
          </span>
          <span className="diff-stat-add">+{added}</span>
          <span className="diff-stat-del">-{removed}</span>
        </div>
        <div className="panel-header-right">
          {task.repo && <span className="model-badge repo-badge">{task.repo}</span>}
          <span className="model-badge">{task.model}</span>
        </div>
      </header>

      <div className="diff-toolbar">
        <div className="task-summary-line">{task.summary}</div>
        <div className="diff-actions">
          <button className="btn" onClick={onBack}>
            {t('task.back')}
          </button>
          {task.status === 'needsReview' && (
            <button className="btn primary" onClick={onApprove}>
              {t('task.approve')}
            </button>
          )}
          {task.status === 'applying' && (
            <span className="applied-chip" style={{ color: 'var(--text-2)' }}>
              <span className="spinner" />
              {t('task.applying')}
            </span>
          )}
          {task.status === 'done' && (
            <>
              <span className="applied-chip">
                <StatusDone size={13} />
                {t('task.applied')}
              </span>
              {task.prUrl && (
                <a className="btn primary" href={task.prUrl} target="_blank" rel="noreferrer">
                  {t('task.viewPr')} ↗
                </a>
              )}
            </>
          )}
          {task.status === 'failed' && (
            <span className="applied-chip" style={{ color: 'var(--red)' }}>
              {t('agents.status.failed')}
            </span>
          )}
        </div>
      </div>

      <div className="diff-body">
        {files.map((f) => (
          <DiffCard key={f.path + '/' + f.name} file={f} />
        ))}
      </div>
    </>
  )
}
