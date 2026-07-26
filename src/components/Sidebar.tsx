import { useEffect, useRef, useState } from 'react'
import type { View } from '../App'
import { useI18n, type Locale, type MessageKey } from '../i18n'
import {
  AgentTasks,
  ChevronDown,
  Compose,
  Inbox,
  Initiatives,
  LinageLogo,
  Moon,
  More,
  MyIssues,
  Projects,
  Pulse,
  Reviews,
  Search,
  StatusInProgress,
  Sun,
} from './Icons'

const REPO_URL = 'https://github.com/kongbaifan/linear_app'

function UserMenu({
  locale,
  theme,
  onToggleTheme,
  onNavigate,
  onSetLocale,
  onInstallApp,
}: {
  locale: Locale
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onNavigate: (v: View) => void
  onSetLocale: (l: Locale) => void
  onInstallApp: () => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setLangOpen(false)
  }

  const link = (url: string) => () => {
    window.open(url, '_blank')
    close()
  }

  const Item = ({
    label,
    kbd,
    onClick,
    chevron,
  }: {
    label: string
    kbd?: string
    onClick: () => void
    chevron?: boolean
  }) => (
    <button className="menu-item" onClick={onClick}>
      <span className="menu-item-label">{label}</span>
      {kbd && <span className="kbd">{kbd}</span>}
      {chevron && <span style={{ color: 'var(--text-3)' }}>›</span>}
    </button>
  )

  return (
    <div className="sidebar-footer" ref={ref}>
      {open && (
        <div className="menu user-menu">
          <Item
            label={t('settings.title')}
            kbd="Ctrl+,"
            onClick={() => {
              close()
              onNavigate({ type: 'settings' })
            }}
          />
          <Item
            label={t('user.usage')}
            onClick={() => {
              close()
              onNavigate({ type: 'settings' })
            }}
          />
          <button className="menu-item" onClick={onToggleTheme}>
            <span className="menu-item-label">{t('action.toggleTheme')}</span>
            <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
              {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            </span>
          </button>
          <Item label={t('action.language')} chevron onClick={() => setLangOpen((o) => !o)} />
          {langOpen && (
            <div className="user-menu-sub">
              {(['en', 'zh'] as const).map((l) => (
                <button
                  key={l}
                  className="menu-item"
                  onClick={() => {
                    onSetLocale(l)
                    close()
                  }}
                >
                  <span className="menu-item-label">{l === 'en' ? 'English' : '中文'}</span>
                  {locale === l && <span className="menu-item-check">✓</span>}
                </button>
              ))}
            </div>
          )}
          <Item label={t('user.getHelp')} onClick={link(`${REPO_URL}#readme`)} />
          <Item label={t('user.feedback')} onClick={link(`${REPO_URL}/issues/new`)} />
          <div className="menu-divider" />
          <Item label={t('user.plans')} onClick={link('https://linage-orpin.vercel.app')} />
          <Item
            label={t('user.apps')}
            onClick={() => {
              close()
              onInstallApp()
            }}
          />
          <Item label={t('user.changelog')} onClick={link(`${REPO_URL}/commits/main`)} />
          <Item label={t('user.learnMore' as MessageKey)} chevron onClick={link(REPO_URL)} />
          <div className="menu-divider" />
          <Item label={t('user.logout')} onClick={close} />
        </div>
      )}
      <button className="user-row" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" style={{ background: 'var(--accent)' }}>
          K
        </span>
        <span className="user-row-name">kung</span>
        <span className="user-row-plan">· Linage</span>
        <ChevronDown size={11} />
      </button>
    </div>
  )
}

export default function Sidebar({
  view,
  onNavigate,
  theme,
  onToggleTheme,
  locale,
  onToggleLocale,
  onSetLocale,
  onInstallApp,
}: {
  view: View
  onNavigate: (v: View) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  locale: Locale
  onToggleLocale: () => void
  onSetLocale: (l: Locale) => void
  onInstallApp: () => void
}) {
  const { t } = useI18n()
  const isIssue = view.type === 'issue'
  const isList = view.type === 'list'
  const isReviews = view.type === 'reviews'
  const isInbox = view.type === 'inbox'
  const isProjects = view.type === 'projects'
  const isAgents = view.type === 'agents'

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="workspace-switcher">
          <span className="workspace-logo">
            <LinageLogo size={10} />
          </span>
          Linage
          <ChevronDown size={11} />
        </button>
        <div className="sidebar-top-actions">
          <button className="icon-btn" title={t('action.search')}>
            <Search />
          </button>
          <button className="icon-btn" title={t('action.newIssue')}>
            <Compose />
          </button>
        </div>
      </div>

      <div className="nav-section">
        <button className={`nav-item${isInbox ? ' active' : ''}`} onClick={() => onNavigate({ type: 'inbox' })}>
          <Inbox />
          {t('nav.inbox')}
        </button>
        <button className={`nav-item${isList ? ' active' : ''}`} onClick={() => onNavigate({ type: 'list' })}>
          <MyIssues />
          {t('nav.myIssues')}
        </button>
        <button className={`nav-item${isReviews ? ' active' : ''}`} onClick={() => onNavigate({ type: 'reviews' })}>
          <Reviews />
          {t('nav.reviews')}
        </button>
        <button className="nav-item">
          <Pulse />
          {t('nav.pulse')}
        </button>
      </div>

      <div className="nav-section">
        <button className="nav-heading">
          {t('nav.workspace')} <ChevronDown size={10} />
        </button>
        <button className="nav-item">
          <Initiatives />
          {t('nav.initiatives')}
        </button>
        <button className={`nav-item${isProjects ? ' active' : ''}`} onClick={() => onNavigate({ type: 'projects' })}>
          <Projects />
          {t('nav.projects')}
        </button>
        <button className="nav-item">
          <More />
          {t('nav.more')}
        </button>
      </div>

      <div className="nav-section">
        <button className="nav-heading">
          {t('nav.favorites')} <ChevronDown size={10} />
        </button>
        <button
          className={`nav-item${isIssue ? ' active' : ''}`}
          onClick={() => onNavigate({ type: 'issue', id: 'LIN-1' })}
        >
          <span className="colored" style={{ display: 'inline-flex' }}>
            <StatusInProgress />
          </span>
          {t('nav.firstSample')}
        </button>
        <button className={`nav-item${isAgents ? ' active' : ''}`} onClick={() => onNavigate({ type: 'agents' })}>
          <AgentTasks />
          {t('nav.agentTasks')}
        </button>
      </div>

      <UserMenu
        locale={locale}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onNavigate={onNavigate}
        onSetLocale={onSetLocale}
        onInstallApp={onInstallApp}
      />
    </aside>
  )
}
