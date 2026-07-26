import { projects, type Project } from '../data/mock'
import { Avatar } from './Avatar'
import { Compose, Initiatives, Insights, Projects as ProjectsIcon, UIRefresh } from './Icons'
import { useI18n, type MessageKey } from '../i18n'

const healthMeta: Record<Project['health'], { key: MessageKey; color: string }> = {
  onTrack: { key: 'health.onTrack', color: '#4cb782' },
  atRisk: { key: 'health.atRisk', color: '#f2c94c' },
  offTrack: { key: 'health.offTrack', color: '#eb5757' },
}

function projectIcon(p: Project) {
  const style = { color: p.color, display: 'inline-flex' }
  switch (p.icon) {
    case 'ui':
      return <span style={style}><UIRefresh /></span>
    case 'insights':
      return <span style={style}><Insights /></span>
    case 'ride':
      return <span style={style}><ProjectsIcon /></span>
    case 'onboarding':
      return <span style={style}><Initiatives /></span>
  }
}

export default function ProjectsView() {
  const { t } = useI18n()
  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('projects.title')}</span>
        </div>
        <div className="panel-header-right">
          <button className="btn sm">
            <Compose size={12} />
            {t('projects.new')}
          </button>
        </div>
      </header>
      <div className="projects-table">
        <div className="projects-head">
          <span className="col-name">{t('projects.name')}</span>
          <span className="col-progress">{t('projects.progress')}</span>
          <span className="col-health">{t('projects.health')}</span>
          <span className="col-lead">{t('projects.lead')}</span>
          <span className="col-target">{t('projects.target')}</span>
        </div>
        {projects.map((p) => {
          const h = healthMeta[p.health]
          return (
            <button key={p.id} className="projects-row">
              <span className="col-name">
                {projectIcon(p)}
                <span className="project-name">{p.name}</span>
                <span className="project-count">{p.issueCount} {t('projects.issues')}</span>
              </span>
              <span className="col-progress">
                <span className="progress-track">
                  <span className="progress-fill" style={{ width: `${p.progress}%`, background: p.color }} />
                </span>
                <span className="progress-num">{p.progress}%</span>
              </span>
              <span className="col-health">
                <span className="chip-dot" style={{ background: h.color }} />
                {t(h.key)}
              </span>
              <span className="col-lead">
                <Avatar user={p.lead} />
                {p.lead}
              </span>
              <span className="col-target">{p.target}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
