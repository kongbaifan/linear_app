import { useEffect, useRef, useState } from 'react'
import type { ExecutorKey, Issue, PriorityKey, Project, StatusKey } from '../data/mock'
import { Dropdown } from './Dropdown'
import { allLabels, executorOrder, priorityMeta, priorityOrder, statusMeta, statusOrder } from './meta'
import { Avatar } from './Avatar'
import { LinageLogo, Projects as ProjectsIcon } from './Icons'
import { useI18n, type MessageKey } from '../i18n'

const executorLabel: Record<ExecutorKey, MessageKey> = {
  me: 'executor.me',
  agent: 'executor.agent',
}

export default function NewIssueModal({
  projects,
  onClose,
  onCreate,
}: {
  projects: Project[]
  onClose: () => void
  onCreate: (issue: Omit<Issue, 'id' | 'createdAt'>) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [status, setStatus] = useState<StatusKey>('todo')
  const [priority, setPriority] = useState<PriorityKey>('medium')
  const [executor, setExecutor] = useState<ExecutorKey>('me')
  const [project, setProject] = useState<string | undefined>(undefined)
  const [labels, setLabels] = useState<{ name: string; color: string }[]>([])
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => titleRef.current?.focus(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const submit = () => {
    if (!title.trim()) return
    onCreate({
      title: title.trim(),
      description: desc.trim() || undefined,
      status,
      priority,
      executor,
      project,
      labels,
    })
  }

  const proj = projects.find((p) => p.id === project)

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-breadcrumb">
          <span className="workspace-logo" style={{ width: 16, height: 16 }}>
            <LinageLogo size={9} />
          </span>
          LIN
          <span className="crumb-sep">›</span>
          {t('modal.newIssue')}
        </div>
        <input
          ref={titleRef}
          className="modal-title-input"
          placeholder={t('modal.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="modal-desc-input"
          placeholder={t('modal.descPlaceholder')}
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className="modal-chips">
          <Dropdown
            trigger={() => (
              <button className="btn sm">
                {statusMeta[status].icon(13)}
                {t(`status.${status}`)}
              </button>
            )}
            options={statusOrder.map((s) => ({
              key: s,
              label: t(`status.${s}`),
              icon: statusMeta[s].icon(13),
              checked: s === status,
            }))}
            onSelect={(k) => setStatus(k as StatusKey)}
          />
          <Dropdown
            trigger={() => (
              <button className="btn sm">
                {priorityMeta[priority].icon(13)}
                {t(`priority.${priority}`)}
              </button>
            )}
            options={priorityOrder.map((p) => ({
              key: p,
              label: t(`priority.${p}`),
              icon: priorityMeta[p].icon(13),
              checked: p === priority,
            }))}
            onSelect={(k) => setPriority(k as PriorityKey)}
          />
          <Dropdown
            trigger={() => (
              <button className="btn sm">
                <Avatar user={executor} size="sm" />
                {t(executorLabel[executor])}
              </button>
            )}
            options={executorOrder.map((e) => ({
              key: e,
              label: t(executorLabel[e]),
              icon: <Avatar user={e} size="sm" />,
              checked: executor === e,
            }))}
            onSelect={(k) => setExecutor(k as ExecutorKey)}
          />
          <Dropdown
            trigger={() => (
              <button className="btn sm">
                <ProjectsIcon size={13} />
                {proj ? proj.name : t('issue.noProject')}
              </button>
            )}
            options={[
              { key: '', label: t('issue.noProject'), checked: !project },
              ...projects.map((p) => ({
                key: p.id,
                label: p.name,
                icon: <span className="chip-dot" style={{ background: p.color }} />,
                checked: project === p.id,
              })),
            ]}
            onSelect={(k) => setProject(k || undefined)}
          />
          <Dropdown
            closeOnSelect={false}
            trigger={() => (
              <button className="btn sm">
                {labels.length === 0
                  ? t('modal.labels')
                  : labels.map((l) => (
                      <span key={l.name} className="chip-dot" style={{ background: l.color }} />
                    ))}
                {labels.length > 0 && labels.map((l) => l.name).join(', ')}
              </button>
            )}
            options={allLabels.map((l) => ({
              key: l.name,
              label: l.name,
              icon: <span className="chip-dot" style={{ background: l.color }} />,
              checked: labels.some((x) => x.name === l.name),
            }))}
            onSelect={(k) =>
              setLabels((ls) =>
                ls.some((x) => x.name === k)
                  ? ls.filter((x) => x.name !== k)
                  : [...ls, allLabels.find((x) => x.name === k)!],
              )
            }
          />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button className="btn primary" onClick={submit} disabled={!title.trim()} style={{ opacity: title.trim() ? 1 : 0.5 }}>
            {t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
