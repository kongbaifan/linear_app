import { useEffect, useMemo, useRef, useState } from 'react'
import type { View } from '../App'
import type { Issue } from '../data/mock'
import { statusMeta } from './meta'
import { Compose, Inbox, Moon, MyIssues, Projects, Reviews, Search, Sun, UIRefresh } from './Icons'
import { useI18n } from '../i18n'

interface Item {
  key: string
  section: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

export default function CommandPalette({
  issues,
  theme,
  onClose,
  onNavigate,
  onCreate,
  onToggleTheme,
  onToggleLocale,
  onReset,
}: {
  issues: Issue[]
  theme: 'dark' | 'light'
  onClose: () => void
  onNavigate: (v: View) => void
  onCreate: () => void
  onToggleTheme: () => void
  onToggleLocale: () => void
  onReset: () => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      {
        key: 'create',
        section: t('palette.actions'),
        label: t('palette.createIssue'),
        hint: 'C',
        icon: <Compose size={14} />,
        run: onCreate,
      },
      {
        key: 'theme',
        section: t('palette.actions'),
        label: theme === 'dark' ? t('palette.toLight') : t('palette.toDark'),
        icon: theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />,
        run: onToggleTheme,
      },
      {
        key: 'language',
        section: t('palette.actions'),
        label: t('palette.language'),
        icon: <span style={{ fontSize: 11, fontWeight: 600 }}>文A</span>,
        run: onToggleLocale,
      },
      {
        key: 'reset',
        section: t('palette.actions'),
        label: t('palette.reset'),
        icon: <UIRefresh size={14} />,
        run: onReset,
      },
      {
        key: 'nav-list',
        section: t('palette.navigation'),
        label: t('palette.goMyIssues'),
        icon: <MyIssues size={14} />,
        run: () => onNavigate({ type: 'list' }),
      },
      {
        key: 'nav-board',
        section: t('palette.navigation'),
        label: t('palette.goBoard'),
        icon: <MyIssues size={14} />,
        run: () => onNavigate({ type: 'list', board: true }),
      },
      {
        key: 'nav-inbox',
        section: t('palette.navigation'),
        label: t('palette.goInbox'),
        icon: <Inbox size={14} />,
        run: () => onNavigate({ type: 'inbox' }),
      },
      {
        key: 'nav-projects',
        section: t('palette.navigation'),
        label: t('palette.goProjects'),
        icon: <Projects size={14} />,
        run: () => onNavigate({ type: 'projects' }),
      },
      {
        key: 'nav-agents',
        section: t('palette.navigation'),
        label: t('palette.goAgents'),
        icon: <Compose size={14} />,
        run: () => onNavigate({ type: 'agents' }),
      },
      {
        key: 'nav-reviews',
        section: t('palette.navigation'),
        label: t('palette.goReviews'),
        icon: <Reviews size={14} />,
        run: () => onNavigate({ type: 'diff', id: 'ENG-2498' }),
      },
      ...issues.map<Item>((i) => ({
        key: i.id,
        section: t('palette.issues'),
        label: i.title,
        hint: i.id,
        icon: statusMeta[i.status].icon(13),
        run: () => onNavigate({ type: 'issue', id: i.id }),
      })),
    ]
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((it) => `${it.label} ${it.hint ?? ''}`.toLowerCase().includes(q))
  }, [issues, query, theme, t, onCreate, onNavigate, onToggleTheme, onToggleLocale, onReset])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    listRef.current
      ?.querySelectorAll('.palette-item')
      [active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[active]?.run()
    }
  }

  let lastSection = ''
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette">
        <div className="palette-input-row">
          <Search size={14} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder={t('palette.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">{t('palette.noResults')}</div>}
          {items.map((it, idx) => {
            const showSection = it.section !== lastSection
            lastSection = it.section
            return (
              <div key={it.key}>
                {showSection && <div className="palette-section">{it.section}</div>}
                <button
                  className={`palette-item${idx === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={it.run}
                >
                  <span className="palette-item-icon">{it.icon}</span>
                  <span className="palette-item-label">{it.label}</span>
                  {it.hint && <span className="palette-item-hint">{it.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
