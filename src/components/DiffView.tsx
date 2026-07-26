import { useState } from 'react'
import { diffFiles, type DiffFile } from '../data/mock'
import { Avatar } from './Avatar'
import { EmbeddedAgentPanel } from './AgentPanel'
import { useI18n } from '../i18n'
import {
  CopyIcon,
  Eye,
  FileIcon,
  Flag,
  GitBranch,
  LinkIcon,
  StatusDone,
} from './Icons'

function DiffFileCard({ file, thread }: { file: DiffFile; thread?: { afterLine: number } }) {
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
        {file.lines.map((line, i) => (
          <div key={i} className={`diff-line ${line.kind === 'add' ? 'add' : line.kind === 'del' ? 'del' : ''}`}>
            <span className="gutter">{line.no ?? ''}</span>
            <span className="sign">{line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}</span>
            <span className="code" dangerouslySetInnerHTML={{ __html: line.html || ' ' }} />
          </div>
        ))}
        {thread && (
          <div className="diff-comment-row">
            <div className="diff-comment-bubble">
              <Avatar user="nan" />
              <div>
                <div className="comment-head" style={{ marginBottom: 2 }}>
                  <span className="comment-author">Nan</span>
                </div>
                <div className="comment-body">
                  Do we need both waitingStatusById and dimmedIds here?
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DiffView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'activity' | 'guide' | 'diff'>('diff')

  return (
    <>
      <header className="diff-header">
        <div className="diff-header-left">
          <StatusDone size={15} />
          <button className="issue-ref" onClick={onBack}>
            ENG-2498
          </button>
          <span className="crumb-sep">›</span>
          <span className="branch-name">
            <GitBranch size={13} />
            Dimmed Status Cards
          </span>
          <span className="diff-stat-add">+34</span>
          <span className="diff-stat-del">-18</span>
        </div>
        <div className="panel-header-right">
          <button className="icon-btn">
            <LinkIcon />
          </button>
          <button className="icon-btn">
            <CopyIcon />
          </button>
        </div>
      </header>

      <div className="diff-toolbar">
        <div className="tab-group">
          {(['activity', 'guide', 'diff'] as const).map((k) => (
            <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
              {t(`diff.tab.${k}`)}
            </button>
          ))}
        </div>
        <div className="diff-actions">
          <button className="btn">{t('diff.submitReview')}</button>
          <button className="btn">
            <Eye size={13} />
            {t('diff.preview')}
          </button>
          <button className="icon-btn">
            <Flag size={13} />
          </button>
        </div>
      </div>

      <div className="diff-layout">
        <div className="diff-body">
          <DiffFileCard file={diffFiles[0]} thread={{ afterLine: 85 }} />
          <DiffFileCard file={diffFiles[1]} />
        </div>
        <EmbeddedAgentPanel />
      </div>
    </>
  )
}
