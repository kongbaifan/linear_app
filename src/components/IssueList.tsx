import { useState } from 'react'
import type { Issue, StatusKey } from '../data/mock'
import { Avatar } from './Avatar'
import BoardView from './BoardView'
import { priorityMeta, statusMeta } from './meta'
import { useI18n } from '../i18n'

const groupOrder: StatusKey[] = ['inProgress', 'todo', 'done']

function ViewToggle({ board, onToggle }: { board: boolean; onToggle: (b: boolean) => void }) {
  const { t } = useI18n()
  return (
    <span className="tab-group view-toggle">
      <button className={`tab${!board ? ' active' : ''}`} onClick={() => onToggle(false)} title={t('list.viewList')}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <button className={`tab${board ? ' active' : ''}`} onClick={() => onToggle(true)} title={t('list.viewBoard')}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2.5" width="5" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9" y="2.5" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
    </span>
  )
}

export default function IssueList({
  issues,
  selectedId,
  onSelect,
  onOpen,
  onMove,
  board = false,
  onToggleBoard,
}: {
  issues: Issue[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onMove: (dragId: string, status: StatusKey, beforeId?: string) => void
  board?: boolean
  onToggleBoard?: (board: boolean) => void
}) {
  const { t } = useI18n()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropBefore, setDropBefore] = useState<string | null>(null)
  const [dropGroup, setDropGroup] = useState<StatusKey | null>(null)

  const clearDrag = () => {
    setDragId(null)
    setDropBefore(null)
    setDropGroup(null)
  }

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('nav.myIssues')}</span>
        </div>
        <div className="panel-header-right">
          {!board && (
            <span className="shortcut-hints">
              <span className="kbd">⌘K</span> {t('list.hint.commands')}
            </span>
          )}
          {onToggleBoard && <ViewToggle board={board} onToggle={onToggleBoard} />}
        </div>
      </header>
      <div className="list-toolbar">
        <button className="filter-btn">{t('list.filter')}</button>
      </div>
      {board ? (
        <BoardView issues={issues} onOpen={onOpen} onMove={onMove} />
      ) : (
      <div className="issue-groups">
        {groupOrder.map((status) => {
          const group = issues.filter((i) => i.status === status)
          const meta = statusMeta[status]
          return (
            <section
              key={status}
              className={dropGroup === status && !dropBefore ? 'drop-group' : ''}
              onDragOver={(e) => {
                e.preventDefault()
                setDropGroup(status)
              }}
              onDragLeave={() => setDropGroup((g) => (g === status ? null : g))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId) onMove(dragId, status)
                clearDrag()
              }}
            >
              <div className="group-header">
                {meta.icon()}
                {t(`status.${status}`)}
                <span className="group-count">{group.length}</span>
              </div>
              {group.length === 0 && <div className="group-empty">{t('board.dropHere')}</div>}
              {group.map((issue) => (
                <button
                  key={issue.id}
                  draggable
                  className={`issue-row${issue.id === selectedId ? ' selected' : ''}${
                    dropBefore === issue.id ? ' drop-before' : ''
                  }${dragId === issue.id ? ' dragging' : ''}`}
                  onClick={() => {
                    onSelect(issue.id)
                    onOpen(issue.id)
                  }}
                  onDragStart={(e) => {
                    setDragId(issue.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={clearDrag}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDropBefore(issue.id)
                    setDropGroup(status)
                  }}
                  onDragLeave={() => setDropBefore((b) => (b === issue.id ? null : b))}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (dragId) onMove(dragId, status, issue.id)
                    clearDrag()
                  }}
                >
                  <span className="prio">{priorityMeta[issue.priority].icon()}</span>
                  <span className="issue-id">{issue.id}</span>
                  {meta.icon()}
                  <span className="issue-row-title">{issue.title}</span>
                  {issue.sample && <span className="sample-badge">{t('issue.sample')}</span>}
                  <span className="issue-row-spacer" />
                  <span className="meta">
                    {issue.labels.map((l) => (
                      <span key={l.name} className="chip">
                        <span className="chip-dot" style={{ background: l.color }} />
                        {l.name}
                      </span>
                    ))}
                    <span>
                      {new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <Avatar user={issue.executor} />
                  </span>
                </button>
              ))}
            </section>
          )
        })}
      </div>
      )}
    </>
  )
}
