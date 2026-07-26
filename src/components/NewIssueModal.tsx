import { useEffect, useRef, useState } from 'react'
import type { Issue, PriorityKey, StatusKey } from '../data/mock'
import { users } from '../data/mock'
import { Dropdown } from './Dropdown'
import { allLabels, priorityMeta, priorityOrder, statusMeta, statusOrder } from './meta'
import { Avatar } from './Avatar'
import { LinearLogo } from './Icons'
import { useI18n } from '../i18n'

export default function NewIssueModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (issue: Omit<Issue, 'id' | 'date'>) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [status, setStatus] = useState<StatusKey>('todo')
  const [priority, setPriority] = useState<PriorityKey>('medium')
  const [assignee, setAssignee] = useState<string | undefined>(undefined)
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
    onCreate({ title: title.trim(), status, priority, assignee, labels })
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-breadcrumb">
          <span className="workspace-logo" style={{ width: 16, height: 16 }}>
            <LinearLogo size={9} />
          </span>
          ENG
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
                {assignee ? <Avatar user={assignee} size="sm" /> : null}
                {assignee ?? t('modal.assignee')}
              </button>
            )}
            options={[
              { key: '', label: t('issue.noAssignee'), checked: !assignee },
              ...Object.keys(users).map((u) => ({
                key: u,
                label: users[u].name,
                icon: <Avatar user={u} size="sm" />,
                checked: assignee === u,
              })),
            ]}
            onSelect={(k) => setAssignee(k || undefined)}
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
