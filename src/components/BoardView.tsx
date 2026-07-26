import { useState } from 'react'
import type { Issue, StatusKey } from '../data/mock'
import { Avatar } from './Avatar'
import { priorityMeta, statusMeta } from './meta'
import { useI18n } from '../i18n'

const columns: StatusKey[] = ['inProgress', 'todo', 'done']

export default function BoardView({
  issues,
  onOpen,
  onMove,
  onNewInStatus,
}: {
  issues: Issue[]
  onOpen: (id: string) => void
  onMove: (dragId: string, status: StatusKey, beforeId?: string) => void
  onNewInStatus: (status: StatusKey) => void
}) {
  const { t } = useI18n()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropCol, setDropCol] = useState<StatusKey | null>(null)
  const [dropBefore, setDropBefore] = useState<string | null>(null)

  const clear = () => {
    setDragId(null)
    setDropCol(null)
    setDropBefore(null)
  }

  return (
    <div className="board">
      {columns.map((status) => {
        const group = issues.filter((i) => i.status === status)
        const meta = statusMeta[status]
        return (
          <div
            key={status}
            className={`board-col${dropCol === status ? ' drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDropCol(status)
            }}
            onDragLeave={() => setDropCol((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragId) onMove(dragId, status)
              clear()
            }}
          >
            <div className="board-col-header">
              {meta.icon()}
              <span className="board-col-title">{t(`status.${status}`)}</span>
              <span className="group-count">{group.length}</span>
              <span className="board-col-actions">
                <button
                  className="icon-btn"
                  title={t('board.newHere')}
                  onClick={() => onNewInStatus(status)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            </div>
            <div className="board-col-cards">
              {group.map((issue) => (
                <button
                  key={issue.id}
                  className={`board-card${dragId === issue.id ? ' dragging' : ''}${
                    dropBefore === issue.id ? ' drop-before' : ''
                  }`}
                  draggable
                  onClick={() => onOpen(issue.id)}
                  onDragStart={(e) => {
                    setDragId(issue.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={clear}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDropBefore(issue.id)
                    setDropCol(status)
                  }}
                  onDragLeave={() => setDropBefore((b) => (b === issue.id ? null : b))}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (dragId) onMove(dragId, status, issue.id)
                    clear()
                  }}
                >
                  <div className="board-card-top">
                    <span className="issue-id">{issue.id}</span>
                    <Avatar user={issue.executor} size="sm" />
                  </div>
                  <div className="board-card-title">
                    {priorityMeta[issue.priority].icon(13)}
                    {issue.title}
                  </div>
                  {issue.labels.length > 0 && (
                    <div className="board-card-labels">
                      {issue.labels.map((l) => (
                        <span key={l.name} className="chip">
                          <span className="chip-dot" style={{ background: l.color }} />
                          {l.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
