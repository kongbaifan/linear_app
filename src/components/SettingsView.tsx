import { useEffect, useRef, useState } from 'react'
import type { AgentSettings, ProviderProfile, Theme } from '../store'
import { PROVIDER_DEFAULTS, SIMULATED_ID } from '../store'
import { anthropicHeaders, anthropicMessagesUrl, listModels, proxied } from '../agent/provider'
import { useI18n, type Locale } from '../i18n'
import { Moon, StatusDone, Sun } from './Icons'

const MODEL_HINTS: Record<'anthropic' | 'openai', string[]> = {
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'deepseek-reasoner', 'kimi-k2', 'glm-4.7', 'qwen3-coder'],
}

// ccswitch-style presets: pick one, tweak, save.
const PRESETS: { name: string; kind: 'anthropic' | 'openai'; baseUrl: string; model: string }[] = [
  { name: 'Claude 中转站', kind: 'anthropic', baseUrl: '', model: 'claude-sonnet-4-5' },
  { name: 'OpenAI 中转站', kind: 'openai', baseUrl: '', model: '' },
  { name: 'Anthropic 官方', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
  { name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Kimi (Moonshot)', kind: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2-0711-preview' },
  { name: '智谱 GLM', kind: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.6' },
  { name: '通义千问', kind: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3-max' },
  { name: '硅基流动', kind: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  { name: 'OpenAI 官方', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
]

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string }

function TestBadge({ state }: { state?: TestState }) {
  const { t } = useI18n()
  if (!state || state.status === 'idle') return null
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
  onSaveProfile,
  onDeleteProfile,
  onActivate,
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
  onSaveProfile: (profile: ProviderProfile) => void
  onDeleteProfile: (id: string) => void
  onActivate: (id: string) => void
  onTheme: (t: Theme) => void
  onLocale: (l: Locale) => void
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
  storageBytes: number
}) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<ProviderProfile | null>(null)
  const [tests, setTests] = useState<Record<string, TestState>>({})
  const [ghTest, setGhTest] = useState<TestState>({ status: 'idle' })
  const [models, setModels] = useState<string[] | null>(null)
  const [modelsState, setModelsState] = useState<TestState>({ status: 'idle' })
  const active = settings.activeProviderId

  const fetchModels = async (p: ProviderProfile, silent = false) => {
    if (!p.apiKey) return
    if (!silent) setModelsState({ status: 'testing' })
    try {
      const list = await listModels(p)
      setModels(list)
      setDraft((d) => d && { ...d, models: list })
      setModelsState({
        status: 'ok',
        message: `${list.length} ${t('provider.modelsFound')}`,
      })
    } catch (e) {
      if (silent) {
        setModelsState({ status: 'idle' })
      } else {
        setModelsState({
          status: 'fail',
          message: `${t('provider.fetchFail')}: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    }
  }

  // Opening the form (add or edit) resets the model list; a profile with a
  // key auto-refreshes its list quietly — "自动识别" without a click.
  useEffect(() => {
    setModels(draft?.models ?? null)
    setModelsState({ status: 'idle' })
    if (draft?.apiKey) void fetchModels(draft, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id])

  const setTest = (key: string, state: TestState) => setTests((s) => ({ ...s, [key]: state }))

  const testProfile = async (p: ProviderProfile, key: string, isDraft = false) => {
    setTest(key, { status: 'testing' })
    const { url, headers } =
      p.kind === 'anthropic'
        ? { url: anthropicMessagesUrl(p.baseUrl), headers: anthropicHeaders(p.apiKey, p.baseUrl) }
        : {
            url: `${stripSlash(p.baseUrl || PROVIDER_DEFAULTS.openai.baseUrl)}/chat/completions`,
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${p.apiKey}`,
            } as Record<string, string>,
          }
    const post = (u: string) =>
      fetch(u, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: p.model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
      })
    const report = async (res: Response, viaProxy: boolean) => {
      if (res.ok) {
        // Guard against SPA-fallback servers answering /api/proxy with HTML.
        const ct = res.headers.get('content-type') ?? ''
        if (viaProxy && !ct.includes('json') && !ct.includes('event-stream')) {
          setTest(key, { status: 'fail', message: t('settings.corsFail') })
          return
        }
        if (viaProxy && !p.proxy) {
          // Direct was CORS-blocked but the proxy works — remember that.
          if (isDraft) setDraft((d) => d && { ...d, proxy: true })
          else onSaveProfile({ ...p, proxy: true })
          setTest(key, { status: 'ok', message: t('settings.proxyWorked') })
        } else {
          setTest(key, { status: 'ok', message: `${p.model} · ${t('settings.testOk')}` })
        }
        return
      }
      // Surface the server's own error text — 401 vs 404 vs bad model
      // are very different fixes.
      let detail = `HTTP ${res.status}`
      try {
        const data = await res.json()
        const msg = data?.error?.message ?? data?.message
        if (msg) detail += ` — ${String(msg).slice(0, 140)}`
      } catch {
        // non-JSON error body
      }
      setTest(key, { status: 'fail', message: viaProxy ? `${detail} (via proxy)` : detail })
    }
    try {
      await report(await post(p.proxy ? proxied(url) : url), p.proxy === true)
    } catch (e) {
      if (!(e instanceof TypeError) || p.proxy) {
        setTest(key, { status: 'fail', message: e instanceof Error ? e.message : String(e) })
        return
      }
      // Direct call never reached the server (CORS/DNS) — probe the proxy.
      try {
        const res = await post(proxied(url))
        if (res.status === 404) {
          // No proxy here (plain local dev) — report the original diagnosis.
          setTest(key, { status: 'fail', message: t('settings.corsFail') })
        } else {
          await report(res, true)
        }
      } catch {
        setTest(key, { status: 'fail', message: t('settings.corsFail') })
      }
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

  const newDraft = (): ProviderProfile => ({
    id: `p-${Date.now()}`,
    name: '',
    kind: 'anthropic',
    baseUrl: '',
    apiKey: '',
    model: 'claude-sonnet-4-5',
  })

  const applyPreset = (ps: (typeof PRESETS)[number]) =>
    setDraft((d) => d && { ...d, name: ps.name, kind: ps.kind, baseUrl: ps.baseUrl, model: ps.model })

  const switchDraftKind = (kind: 'anthropic' | 'openai') =>
    setDraft(
      (d) =>
        d && {
          ...d,
          kind,
          model: MODEL_HINTS[kind].includes(d.model) ? d.model : PROVIDER_DEFAULTS[kind].model,
        },
    )

  const saveDraft = () => {
    if (!draft || !draft.name.trim() || !draft.apiKey) return
    onSaveProfile({
      ...draft,
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      apiKey: draft.apiKey.trim(),
    })
    setTest('draft', { status: 'idle' })
    setDraft(null)
  }

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('settings.title')}</span>
        </div>
      </header>
      <div className="settings-page">
        {/* ── AI providers (ccswitch-style profiles) ─────────── */}
        <section className="settings-section">
          <h3 className="settings-section-title">{t('settings.aiSection')}</h3>
          <p className="settings-section-desc">{t('provider.listDesc')}</p>

          <div className="provider-list">
            <div className={`provider-row${active === SIMULATED_ID ? ' active' : ''}`}>
              <span className="provider-dot" />
              <div className="provider-main">
                <span className="provider-name">{t('provider.simulated')}</span>
                <span className="provider-url">{t('provider.simulatedDesc')}</span>
              </div>
              <div className="provider-actions">
                {active === SIMULATED_ID ? (
                  <span className="provider-active-badge">{t('provider.active')}</span>
                ) : (
                  <button className="btn sm" onClick={() => onActivate(SIMULATED_ID)}>
                    {t('provider.use')}
                  </button>
                )}
              </div>
            </div>

            {settings.providers.map((p) => (
              <div key={p.id} className={`provider-row${p.id === active ? ' active' : ''}`}>
                <span className="provider-dot" />
                <div className="provider-main">
                  <span className="provider-name">
                    {p.name}
                    <span className="provider-kind-badge">
                      {p.kind === 'anthropic' ? 'Claude' : 'OpenAI'}
                    </span>
                    {p.proxy && <span className="provider-kind-badge">{t('provider.proxyBadge')}</span>}
                  </span>
                  <span className="provider-url">
                    {p.baseUrl || PROVIDER_DEFAULTS[p.kind].baseUrl} · {p.model}
                  </span>
                  <TestBadge state={tests[p.id]} />
                </div>
                <div className="provider-actions">
                  {p.id === active ? (
                    <span className="provider-active-badge">{t('provider.active')}</span>
                  ) : (
                    <button className="btn sm" onClick={() => onActivate(p.id)}>
                      {t('provider.use')}
                    </button>
                  )}
                  <button className="btn sm" onClick={() => testProfile(p, p.id)}>
                    {t('settings.test')}
                  </button>
                  <button className="btn sm" onClick={() => setDraft({ ...p })}>
                    {t('provider.edit')}
                  </button>
                  <button className="btn sm danger" onClick={() => onDeleteProfile(p.id)}>
                    {t('provider.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!draft && (
            <button className="btn sm add-provider-btn" onClick={() => setDraft(newDraft())}>
              + {t('provider.add')}
            </button>
          )}

          {draft && (
            <div className="provider-form">
              <label className="settings-label">{t('provider.presets')}</label>
              <div className="preset-chips">
                {PRESETS.map((ps) => (
                  <button key={ps.name} className="preset-chip" onClick={() => applyPreset(ps)}>
                    {ps.name}
                  </button>
                ))}
              </div>

              <label className="settings-label">{t('provider.name')}</label>
              <input
                className="settings-input pf-name"
                placeholder={t('provider.namePlaceholder')}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />

              <label className="settings-label">{t('provider.format')}</label>
              <div className="tab-group" style={{ display: 'inline-flex' }}>
                <button
                  className={`tab${draft.kind === 'anthropic' ? ' active' : ''}`}
                  onClick={() => switchDraftKind('anthropic')}
                >
                  {t('provider.anthropicFmt')}
                </button>
                <button
                  className={`tab${draft.kind === 'openai' ? ' active' : ''}`}
                  onClick={() => switchDraftKind('openai')}
                >
                  {t('provider.openaiFmt')}
                </button>
              </div>

              <label className="settings-label">{t('provider.baseUrl')}</label>
              <input
                className="settings-input pf-base"
                placeholder={PROVIDER_DEFAULTS[draft.kind].baseUrl}
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value.trim() })}
              />
              <div className="settings-hint">
                {draft.kind === 'anthropic' ? t('provider.anthropicHint') : t('provider.openaiHint')}
              </div>

              <label className="settings-label">API key</label>
              <input
                className="settings-input pf-key"
                type="password"
                placeholder={draft.kind === 'anthropic' ? 'sk-ant-… / sk-…' : 'sk-…'}
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value.trim() })}
              />

              <label className="settings-label">{t('agents.model')}</label>
              <div className="settings-row">
                <input
                  className="settings-input pf-model"
                  list="model-options"
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value.trim() })}
                />
                <button
                  className="btn sm fetch-models-btn"
                  onClick={() => fetchModels(draft)}
                  disabled={!draft.apiKey}
                >
                  {t('provider.fetchModels')}
                </button>
              </div>
              <datalist id="model-options">
                {[...new Set([...(models ?? []), ...MODEL_HINTS[draft.kind]])].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <TestBadge state={modelsState} />
              {models && models.length > 0 && (
                <div className="model-list">
                  {models.map((m) => (
                    <button
                      key={m}
                      className={`model-option${m === draft.model ? ' active' : ''}`}
                      onClick={() => setDraft({ ...draft, model: m })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={draft.proxy === true}
                  onChange={(e) => setDraft({ ...draft, proxy: e.target.checked })}
                />
                <span>{t('provider.proxy')}</span>
              </label>
              <div className="settings-hint">{t('provider.proxyHint')}</div>

              <TestBadge state={tests['draft']} />
              <div className="settings-row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn sm" onClick={() => testProfile(draft, 'draft', true)} disabled={!draft.apiKey}>
                  {t('settings.test')}
                </button>
                <button
                  className="btn sm primary"
                  onClick={saveDraft}
                  disabled={!draft.name.trim() || !draft.apiKey}
                >
                  {t('provider.saveBtn')}
                </button>
                <button
                  className="btn sm"
                  onClick={() => {
                    setDraft(null)
                    setTest('draft', { status: 'idle' })
                  }}
                >
                  {t('provider.cancel')}
                </button>
              </div>
              <div className="settings-hint">{t('agents.apiKeyHint')}</div>
            </div>
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
