import { useEffect, useState } from 'react'
import type { Issue, Project } from '../data/mock'
import { useI18n } from '../i18n'
import { Compose, GitBranch, Projects as ProjectsIcon, StatusDone } from './Icons'

interface Repo {
  full_name: string
  language: string | null
  pushed_at: string
  private: boolean
}

const PALETTE = ['#5e6ad2', '#4cb782', '#f2c94c', '#e5734d', '#26b5ce', '#c678dd']

export default function ProjectsView({
  projects,
  issues,
  githubToken,
  githubRepo,
  onAddProject,
  onDeleteProject,
  onSelectRepo,
  onOpenSettings,
}: {
  projects: Project[]
  issues: Issue[]
  githubToken: string
  githubRepo: string
  onAddProject: (p: Project) => void
  onDeleteProject: (id: string) => void
  onSelectRepo: (fullName: string) => void
  onOpenSettings: () => void
}) {
  const { t, locale } = useI18n()
  const [name, setName] = useState('')
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [repoError, setRepoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!githubToken) return
    let cancelled = false
    setLoading(true)
    fetch('https://api.github.com/user/repos?sort=pushed&per_page=20', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${githubToken}`,
      },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (!cancelled) setRepos(data)
      })
      .catch((e) => {
        if (!cancelled) setRepoError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [githubToken])

  const addProject = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAddProject({
      id: `proj-${Date.now()}`,
      name: trimmed,
      color: PALETTE[projects.length % PALETTE.length],
    })
    setName('')
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('projects.title')}</span>
        </div>
      </header>
      <div className="projects-page">
        {/* ── GitHub repositories ────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('projects.repos')}</h3>
          <p className="settings-section-desc">{t('projects.reposDesc')}</p>
          {!githubToken && (
            <button className="btn sm" onClick={onOpenSettings}>
              {t('projects.connectGithub')}
            </button>
          )}
          {loading && (
            <div className="test-result">
              <span className="spinner" /> {t('settings.testing')}
            </div>
          )}
          {repoError && <div className="test-result fail">✕ {repoError}</div>}
          {repos && (
            <div className="repo-list">
              {repos.map((r) => {
                const current = r.full_name === githubRepo
                return (
                  <button key={r.full_name} className="repo-row" onClick={() => onSelectRepo(r.full_name)}>
                    <GitBranch size={14} />
                    <span className="repo-name">{r.full_name}</span>
                    {r.private && <span className="model-badge">private</span>}
                    {r.language && <span className="repo-lang">{r.language}</span>}
                    <span className="issue-row-spacer" />
                    <span className="repo-date">{fmtDate(r.pushed_at)}</span>
                    {current && (
                      <span className="test-result ok" style={{ margin: 0 }}>
                        <StatusDone size={13} /> {t('projects.current')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Local projects ─────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('projects.local')}</h3>
          <p className="settings-section-desc">{t('projects.localDesc')}</p>
          <div className="settings-row" style={{ marginBottom: 10 }}>
            <input
              className="settings-input"
              placeholder={t('projects.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProject()}
            />
            <button className="btn sm" onClick={addProject} disabled={!name.trim()}>
              <Compose size={12} />
              {t('projects.new')}
            </button>
          </div>
          {projects.map((p) => {
            const linked = issues.filter((i) => i.project === p.id)
            const done = linked.filter((i) => i.status === 'done').length
            const pct = linked.length ? Math.round((done / linked.length) * 100) : 0
            return (
              <div key={p.id} className="local-project-row">
                <span style={{ color: p.color, display: 'inline-flex' }}>
                  <ProjectsIcon size={15} />
                </span>
                <span className="project-name">{p.name}</span>
                {p.sample && <span className="sample-badge">{t('issue.sample')}</span>}
                <span className="project-count">
                  {done}/{linked.length} {t('projects.issues')}
                </span>
                <span className="progress-track" style={{ maxWidth: 160 }}>
                  <span className="progress-fill" style={{ width: `${pct}%`, background: p.color }} />
                </span>
                <span className="progress-num">{pct}%</span>
                <span className="issue-row-spacer" />
                <button className="btn sm danger" onClick={() => onDeleteProject(p.id)}>
                  ✕
                </button>
              </div>
            )
          })}
          {projects.length === 0 && <div className="agents-empty">{t('projects.localEmpty')}</div>}
        </section>
      </div>
    </>
  )
}
