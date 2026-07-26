import { useEffect, useRef, useState } from 'react'
import type { AgentSettings } from '../store'
import { useI18n } from '../i18n'

const MODEL_OPTIONS = ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5']

export default function SettingsModal({
  settings,
  onSave,
  onClose,
  onExport,
  onImport,
}: {
  settings: AgentSettings
  onSave: (s: Partial<AgentSettings>) => void
  onClose: () => void
  onExport: () => void
  onImport: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [model, setModel] = useState(settings.model)
  const [githubToken, setGithubToken] = useState(settings.githubToken)
  const [githubRepo, setGithubRepo] = useState(settings.githubRepo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-breadcrumb">{t('agents.settings')}</div>

        <label className="settings-label">{t('agents.apiKey')}</label>
        <input
          className="settings-input"
          type="password"
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <div className="settings-hint">{t('agents.apiKeyHint')}</div>

        <label className="settings-label">{t('agents.model')}</label>
        <input
          className="settings-input"
          list="model-options"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <datalist id="model-options">
          {MODEL_OPTIONS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        <label className="settings-label">{t('github.token')}</label>
        <input
          className="settings-input"
          type="password"
          placeholder="ghp_… / github_pat_…"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
        />
        <label className="settings-label">{t('github.repo')}</label>
        <input
          className="settings-input"
          placeholder="owner/repository"
          value={githubRepo}
          onChange={(e) => setGithubRepo(e.target.value)}
        />
        <div className="settings-hint">{t('github.hint')}</div>

        <label className="settings-label">{t('data.title')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={onExport}>
            {t('data.export')}
          </button>
          <button className="btn sm" onClick={() => fileRef.current?.click()}>
            {t('data.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
        </div>
        <div className="settings-hint">{t('data.hint')}</div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onSave({
                apiKey: apiKey.trim(),
                model: model.trim() || settings.model,
                githubToken: githubToken.trim(),
                githubRepo: githubRepo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''),
              })
              onClose()
            }}
          >
            {t('agents.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
