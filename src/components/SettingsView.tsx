import { useRef, useState } from 'react'
import type { AgentSettings, Theme } from '../store'
import { DEFAULT_AGENT_MODEL } from '../store'
import { useI18n, type Locale } from '../i18n'
import { Moon, StatusDone, Sun } from './Icons'

const MODEL_OPTIONS = ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5']

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string }

function TestBadge({ state }: { state: TestState }) {
  const { t } = useI18n()
  if (state.status === 'idle') return null
  if (state.status === 'testing')
    return (
      <span className="test-result">
        <span className="spinner" /> {t('settings.testing')}
      </span>
    )
  if (state.status === 'ok')
    return (
      <span className="test-result ok">
        <StatusDone size={13} /> {state.message ?? t('settings.testOk')}
      </span>
    )
  return <span className="test-result fail">✕ {state.message ?? t('settings.testFail')}</span>
}

export default function SettingsView({
  settings,
  theme,
  locale,
  onSettings,
  onTheme,
  onLocale,
  onExport,
  onImport,
  onReset,
  storageBytes,
}: {
  settings: AgentSettings
  theme: Theme
  locale: Locale
  onSettings: (patch: Partial<AgentSettings>) => void
  onTheme: (t: Theme) => void
  onLocale: (l: Locale) => void
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
  storageBytes: number
}) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiTest, setAiTest] = useState<TestState>({ status: 'idle' })
  const [ghTest, setGhTest] = useState<TestState>({ status: 'idle' })

  const testAnthropic = async () => {
    setAiTest({ status: 'testing' })
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.model || DEFAULT_AGENT_MODEL,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      })
      if (res.ok) setAiTest({ status: 'ok' })
      else setAiTest({ status: 'fail', message: `HTTP ${res.status}` })
    } catch (e) {
      setAiTest({ status: 'fail', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const testGitHub = async () => {
    setGhTest({ status: 'testing' })
    try {
      const res = await fetch(`https://api.github.com/repos/${settings.githubRepo}`, {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${settings.githubToken}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setGhTest({ status: 'ok', message: `${data.full_name} @ ${data.default_branch}` })
      } else {
        setGhTest({ status: 'fail', message: `HTTP ${res.status}` })
      }
    } catch (e) {
      setGhTest({ status: 'fail', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('settings.title')}</span>
        </div>
      </header>
      <div className="settings-page">
        {/* ── AI ─────────────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('settings.aiSection')}</h3>
          <p className="settings-section-desc">{t('settings.aiDesc')}</p>

          <label className="settings-label">{t('agents.apiKey')}</label>
          <div className="settings-row">
            <input
              className="settings-input"
              type="password"
              placeholder="sk-ant-…"
              value={settings.apiKey}
              onChange={(e) => onSettings({ apiKey: e.target.value.trim() })}
            />
            <button className="btn sm" onClick={testAnthropic} disabled={!settings.apiKey}>
              {t('settings.test')}
            </button>
          </div>
          <TestBadge state={aiTest} />

          <label className="settings-label">{t('agents.model')}</label>
          <input
            className="settings-input"
            list="model-options"
            value={settings.model}
            onChange={(e) => onSettings({ model: e.target.value.trim() || DEFAULT_AGENT_MODEL })}
          />
          <datalist id="model-options">
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <div className="settings-hint">{t('agents.apiKeyHint')}</div>
        </section>

        {/* ── GitHub ─────────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">GitHub</h3>
          <p className="settings-section-desc">{t('github.hint')}</p>

          <label className="settings-label">{t('github.token')}</label>
          <input
            className="settings-input"
            type="password"
            placeholder="ghp_… / github_pat_…"
            value={settings.githubToken}
            onChange={(e) => onSettings({ githubToken: e.target.value.trim() })}
          />

          <label className="settings-label">{t('github.repo')}</label>
          <div className="settings-row">
            <input
              className="settings-input"
              placeholder="owner/repository"
              value={settings.githubRepo}
              onChange={(e) =>
                onSettings({
                  githubRepo: e.target.value
                    .trim()
                    .replace(/^https?:\/\/github\.com\//, '')
                    .replace(/\.git$/, ''),
                })
              }
            />
            <button
              className="btn sm"
              onClick={testGitHub}
              disabled={!settings.githubToken || !settings.githubRepo}
            >
              {t('settings.test')}
            </button>
          </div>
          <TestBadge state={ghTest} />
        </section>

        {/* ── Appearance ─────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('settings.appearance')}</h3>

          <label className="settings-label">{t('settings.theme')}</label>
          <div className="tab-group" style={{ display: 'inline-flex' }}>
            <button className={`tab${theme === 'dark' ? ' active' : ''}`} onClick={() => onTheme('dark')}>
              <Moon size={12} /> {t('settings.dark')}
            </button>
            <button className={`tab${theme === 'light' ? ' active' : ''}`} onClick={() => onTheme('light')}>
              <Sun size={12} /> {t('settings.light')}
            </button>
          </div>

          <label className="settings-label">{t('action.language')}</label>
          <div className="tab-group" style={{ display: 'inline-flex' }}>
            <button className={`tab${locale === 'en' ? ' active' : ''}`} onClick={() => onLocale('en')}>
              English
            </button>
            <button className={`tab${locale === 'zh' ? ' active' : ''}`} onClick={() => onLocale('zh')}>
              中文
            </button>
          </div>
        </section>

        {/* ── Data ───────────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('data.title')}</h3>
          <p className="settings-section-desc">
            {t('data.hint')} ({(storageBytes / 1024).toFixed(1)} KB)
          </p>
          <div className="settings-row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={onExport}>
              {t('data.export')}
            </button>
            <button className="btn sm" onClick={() => fileRef.current?.click()}>
              {t('data.import')}
            </button>
            <button className="btn sm danger" onClick={onReset}>
              {t('palette.reset')}
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
        </section>

        {/* ── About ──────────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('settings.about')}</h3>
          <p className="settings-section-desc">
            Linage v0.1 — {t('settings.aboutDesc')}{' '}
            <a href="https://github.com/kongbaifan/linear_app" target="_blank" rel="noreferrer">
              GitHub
            </a>
            {' · '}
            <a href="https://linage-orpin.vercel.app" target="_blank" rel="noreferrer">
              linage-orpin.vercel.app
            </a>
          </p>
        </section>
      </div>
    </>
  )
}
