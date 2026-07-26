import { useEffect, useState } from 'react'
import type { AgentSettings } from '../store'
import { useI18n } from '../i18n'

const MODEL_OPTIONS = ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5']

export default function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: AgentSettings
  onSave: (s: Partial<AgentSettings>) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [model, setModel] = useState(settings.model)

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

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onSave({ apiKey: apiKey.trim(), model: model.trim() || settings.model })
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
