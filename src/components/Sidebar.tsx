import type { View } from '../App'
import { useI18n, type Locale } from '../i18n'
import {
  AgentTasks,
  ChevronDown,
  Compose,
  Inbox,
  Initiatives,
  Insights,
  LinearLogo,
  Moon,
  More,
  MyIssues,
  Projects,
  Pulse,
  Reviews,
  Search,
  StatusInProgress,
  Sun,
  UIRefresh,
} from './Icons'

export default function Sidebar({
  view,
  onNavigate,
  theme,
  onToggleTheme,
  locale,
  onToggleLocale,
}: {
  view: View
  onNavigate: (v: View) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  locale: Locale
  onToggleLocale: () => void
}) {
  const { t } = useI18n()
  const isIssue = view.type === 'issue'
  const isList = view.type === 'list'
  const isDiff = view.type === 'diff'
  const isInbox = view.type === 'inbox'
  const isProjects = view.type === 'projects'

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="workspace-switcher">
          <span className="workspace-logo">
            <LinearLogo size={10} />
          </span>
          Linear
          <ChevronDown size={11} />
        </button>
        <div className="sidebar-top-actions">
          <button className="icon-btn lang-btn" title={t('action.language')} onClick={onToggleLocale}>
            {locale === 'en' ? '中' : 'EN'}
          </button>
          <button className="icon-btn" title={t('action.toggleTheme')} onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
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
        <button className={`nav-item${isDiff ? ' active' : ''}`} onClick={() => onNavigate({ type: 'diff', id: 'ENG-2498' })}>
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
          onClick={() => onNavigate({ type: 'issue', id: 'ENG-2703' })}
        >
          <span className="colored" style={{ display: 'inline-flex' }}>
            <StatusInProgress />
          </span>
          Faster app launch
        </button>
        <button className="nav-item">
          <AgentTasks />
          {t('nav.agentTasks')}
        </button>
        <button className="nav-item">
          <span className="colored" style={{ display: 'inline-flex', color: '#26b5ce' }}>
            <UIRefresh />
          </span>
          UI Refresh
        </button>
        <button className="nav-item">
          <span className="colored" style={{ display: 'inline-flex', color: '#e5734d' }}>
            <Insights />
          </span>
          {t('nav.agentsInsights')}
        </button>
      </div>
    </aside>
  )
}
