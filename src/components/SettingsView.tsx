import { useRef, useState } from 'react'
import type { AgentSettings, ProviderKind, ProviderSettings, Theme } from '../store'
import { PROVIDER_DEFAULTS } from '../store'
import { useI18n, type Locale, type MessageKey } from '../i18n'
import { Moon, StatusDone, Sun } from './Icons'

const MODEL_HINTS: Record<ProviderKind, string[]> = {
  simulated: [],
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'deepseek-reasoner', 'kimi-k2', 'glm-4.7', 'qwen3-coder'],
}

const KIND_LABEL: Record<ProviderKind, MessageKey> = {
  simulated: 'provider.simulated',
  anthropic: 'provider.anthropic',
  openai: 'provider.openai',
}

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

const stripSlash = (u: string) => u.replace(/\/+$/, '')

export default function SettingsView({
  settings,
  theme,
  locale,
  onSettings,
  onProvider,
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
  onSettings: (patch: Partial<Omit<AgentSettings, 'provider'>>) => void
  onProvider: (patch: Partial<ProviderSettings>) => void
  onTheme: (t: Theme) => void
  onLocale: (l: Locale) => void
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
  storageBytes: number
}) {
  const { t } = useI18n()
  const provider = settings.provider
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiTest, setAiTest] = useState<TestState>({ status: 'idle' })
  const [ghTest, setGhTest] = useState<TestState>({ status: 'idle' })

  const switchKind = (kind: ProviderKind) => {
    if (kind === provider.kind) return
    const prevDefaults = PROVIDER_DEFAULTS[provider.kind]
    const nextDefaults = PROVIDER_DEFAULTS[kind]
    onProvider({
      kind,
      // Base URL: keep only if the user typed a custom one.
      baseUrl:
        !provider.baseUrl || provider.baseUrl === prevDefaults.baseUrl
          ? nextDefaults.baseUrl
          : provider.baseUrl,
      // Model: vendor families don't share model names — reset to the new
      // default unless the current value already belongs to the new family.
      model: MODEL_HINTS[kind].includes(provider.model) ? provider.model : nextDefaults.model,
    })
    setAiTest({ status: 'idle' })
  }

  const testProvider = async () => {
    setAiTest({ status: 'testing' })
    try {
      let res: Response
      if (provider.kind === 'anthropic') {
        res = await fetch(`${stripSlash(provider.baseUrl || PROVIDER_DEFAULTS.anthropic.baseUrl)}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': provider.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
      } else {
        res = await fetch(`${stripSlash(provider.baseUrl || PROVIDER_DEFAULTS.openai.baseUrl)}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
      }
      if (res.ok) setAiTest({ status: 'ok', message: `${provider.model} · ${t('settings.testOk')}` })
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
        {/* ── AI provider ────────────────────────────────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('settings.aiSection')}</h3>
          <p className="settings-section-desc">{t('settings.aiDesc')}</p>

          <label className="settings-label">{t('provider.kind')}</label>
          <div className="tab-group" style={{ display: 'inline-flex' }}>
            {(['simulated', 'anthropic', 'openai'] as const).map((kind) => (
              <button
                key={kind}
                className={`tab${provider.kind === kind ? ' active' : ''}`}
                onClick={() => switchKind(kind)}
              >
                {t(KIND_LABEL[kind])}
              </button>
            ))}
          </div>

          {provider.kind !== 'simulated' && (
            <>
              <label className="settings-label">{t('provider.baseUrl')}</label>
              <input
                className="settings-input"
                placeholder={PROVIDER_DEFAULTS[provider.kind].baseUrl}
                value={provider.baseUrl}
                onChange={(e) => onProvider({ baseUrl: e.target.value.trim() })}
              />
              <div className="settings-hint">
                {provider.kind === 'openai' ? t('provider.openaiHint') : t('provider.anthropicHint')}
              </div>

              <label className="settings-label">API key</label>
              <div className="settings-row">
                <input
                  className="settings-input"
                  type="password"
                  placeholder={provider.kind === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                  value={provider.apiKey}
                  onChange={(e) => onProvider({ apiKey: e.target.value.trim() })}
                />
                <button className="btn sm" onClick={testProvider} disabled={!provider.apiKey}>
                  {t('settings.test')}
                </button>
              </div>
              <TestBadge state={aiTest} />

              <label className="settings-label">{t('agents.model')}</label>
              <input
                className="settings-input"
                list="model-options"
                value={provider.model}
                onChange={(e) => onProvider({ model: e.target.value.trim() })}
              />
              <datalist id="model-options">
                {MODEL_HINTS[provider.kind].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <div className="settings-hint">{t('agents.apiKeyHint')}</div>
            </>
          )}
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
