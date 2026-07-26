// Centralized app store: useReducer + localStorage persistence.
// Storage access is wrapped in try/catch so the app still works in
// sandboxed environments where localStorage is unavailable.
import { useEffect, useReducer } from 'react'
import {
  sampleIssues,
  sampleNotifications,
  sampleProjects,
  type Issue,
  type Notification,
  type Project,
  type StatusKey,
} from './data/mock'

import type { Locale } from './i18n'
import { initialCodebase } from './data/codebase'

export type Theme = 'dark' | 'light'

export type AgentTaskStatus = 'queued' | 'working' | 'needsReview' | 'applying' | 'done' | 'failed'

export interface FileChange {
  path: string
  before: string
  after: string
}

export interface AgentTask {
  id: string
  issueId: string
  title: string
  description?: string
  status: AgentTaskStatus
  model: string
  /** Conversation transcript frozen at delegation time (chat → task). */
  context?: string
  /** Review-page revision requests, in order (task → conversation). */
  revisions?: { instruction: string; time: number }[]
  steps: string[]
  summary?: string
  changes?: FileChange[]
  target: 'virtual' | 'github'
  repo?: string
  baseBranch?: string
  branch?: string
  prUrl?: string
  createdAt: number
  finishedAt?: number
}

// ─── Chat (conversation mode) ───────────────────────────────────
// Linage has two working postures: task mode (delegate → review) and
// conversation mode (stay present, back-and-forth). Chat threads are the
// data atom of the latter.

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  time: number
  /** Model that produced an assistant reply ('simulated' in demo mode). */
  model?: string
  error?: boolean
}

export interface ChatThread {
  id: string
  title: string
  messages: ChatMessage[]
  /** Per-thread model override; falls back to the provider default. */
  model?: string
  createdAt: number
  updatedAt: number
}

/** Caps keep localStorage and JSON backups from growing without bound. */
const MAX_CHAT_THREADS = 50
const MAX_CHAT_MESSAGES = 200

export type ProviderKind = 'simulated' | 'anthropic' | 'openai'

export interface ProviderSettings {
  kind: ProviderKind
  baseUrl: string
  apiKey: string
  model: string
  /** Route requests through /api/proxy (CORS-blocked relay stations). */
  proxy?: boolean
}

/** A saved provider configuration, ccswitch-style: keep several, one active. */
export interface ProviderProfile {
  id: string
  name: string
  kind: 'anthropic' | 'openai'
  baseUrl: string
  apiKey: string
  model: string
  /** Route requests through /api/proxy (CORS-blocked relay stations). */
  proxy?: boolean
}

/** activeProviderId value meaning "no real provider — built-in simulator". */
export const SIMULATED_ID = 'simulated'

export interface AgentSettings {
  /** Runtime provider (what the engine and chat actually call). Kept in
   *  sync with the active profile; 'simulated' when SIMULATED_ID active. */
  provider: ProviderSettings
  /** Saved provider profiles (中转站、官方 API……), switchable in Settings. */
  providers: ProviderProfile[]
  activeProviderId: string
  githubToken: string
  githubRepo: string
}

export const DEFAULT_AGENT_MODEL = 'claude-sonnet-4-5'

export const PROVIDER_DEFAULTS: Record<ProviderKind, { baseUrl: string; model: string }> = {
  simulated: { baseUrl: '', model: '' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: DEFAULT_AGENT_MODEL },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
}

export interface AppState {
  issues: Issue[]
  notifications: Notification[]
  projects: Project[]
  theme: Theme
  locale: Locale
  agentTasks: AgentTask[]
  chats: ChatThread[]
  settings: AgentSettings
  codebase: Record<string, string>
}

export type Action =
  | { type: 'updateIssue'; id: string; patch: Partial<Issue> }
  | { type: 'addIssue'; issue: Issue }
  | { type: 'moveIssue'; dragId: string; status: StatusKey; beforeId?: string }
  | { type: 'readNotification'; id: string }
  | { type: 'readAllNotifications' }
  | { type: 'addProject'; project: Project }
  | { type: 'deleteProject'; id: string }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'setLocale'; locale: Locale }
  | { type: 'delegate'; task: AgentTask }
  | { type: 'agentStep'; id: string; step: string }
  | { type: 'agentStatus'; id: string; status: AgentTaskStatus; summary?: string }
  | { type: 'agentResult'; id: string; summary: string; changes: FileChange[]; baseBranch?: string }
  | { type: 'applyChanges'; id: string }
  | { type: 'githubApplied'; id: string; prUrl: string; branch: string }
  | { type: 'retryTask'; id: string }
  | { type: 'reviseTask'; id: string; instruction: string }
  | { type: 'newChat'; thread: ChatThread }
  | { type: 'chatMessage'; threadId: string; message: ChatMessage }
  | { type: 'setChatModel'; threadId: string; model: string }
  | { type: 'deleteChat'; id: string }
  | { type: 'setSettings'; settings: Partial<Omit<AgentSettings, 'provider'>> }
  | { type: 'setProvider'; provider: Partial<ProviderSettings> }
  | { type: 'saveProviderProfile'; profile: ProviderProfile }
  | { type: 'deleteProviderProfile'; id: string }
  | { type: 'activateProvider'; id: string }
  | { type: 'importState'; data: unknown }
  | { type: 'reset' }

const STORAGE_KEY = 'linage-state-v2'
const LEGACY_KEY = 'linear-clone-state-v1'

function defaultState(): AppState {
  return {
    issues: sampleIssues(),
    notifications: sampleNotifications(),
    projects: sampleProjects(),
    theme: 'dark',
    locale: 'zh',
    agentTasks: [],
    chats: [],
    settings: {
      provider: { kind: 'simulated', baseUrl: '', apiKey: '', model: '' },
      providers: [],
      activeProviderId: SIMULATED_ID,
      githubToken: '',
      githubRepo: '',
    },
    codebase: { ...initialCodebase },
  }
}

function sanitizeProvider(settings: any): ProviderSettings {
  const p = settings?.provider
  if (p && ['simulated', 'anthropic', 'openai'].includes(p.kind)) {
    return {
      kind: p.kind,
      baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
      apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
      model: typeof p.model === 'string' ? p.model : '',
    }
  }
  // Migrate the legacy flat shape { apiKey, model }.
  const legacyKey = typeof settings?.apiKey === 'string' ? settings.apiKey : ''
  const legacyModel = typeof settings?.model === 'string' ? settings.model : DEFAULT_AGENT_MODEL
  return legacyKey
    ? { kind: 'anthropic', baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl, apiKey: legacyKey, model: legacyModel }
    : { kind: 'simulated', baseUrl: '', apiKey: '', model: '' }
}

const SIMULATED_PROVIDER: ProviderSettings = { kind: 'simulated', baseUrl: '', apiKey: '', model: '' }

const profileToProvider = (p: ProviderProfile): ProviderSettings => ({
  kind: p.kind,
  baseUrl: p.baseUrl,
  apiKey: p.apiKey,
  model: p.model,
  proxy: p.proxy === true,
})

function sanitizeSettings(settings: any): AgentSettings {
  const provider = sanitizeProvider(settings)
  let providers: ProviderProfile[] = Array.isArray(settings?.providers)
    ? settings.providers
        .filter((p: any) => p && typeof p.id === 'string' && (p.kind === 'anthropic' || p.kind === 'openai'))
        .map((p: any) => ({
          id: p.id,
          name: typeof p.name === 'string' && p.name ? p.name : p.kind,
          kind: p.kind,
          baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
          apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
          model: typeof p.model === 'string' ? p.model : '',
          proxy: p.proxy === true,
        }))
    : []
  let activeProviderId =
    typeof settings?.activeProviderId === 'string' ? settings.activeProviderId : ''
  // Migration: a pre-profiles config becomes the first saved profile.
  if (!Array.isArray(settings?.providers) && provider.kind !== 'simulated') {
    providers = [
      {
        id: 'p-legacy',
        name: provider.kind === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI 兼容',
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.model,
      },
    ]
    activeProviderId = 'p-legacy'
  }
  const active = providers.find((p) => p.id === activeProviderId)
  return {
    provider: active ? profileToProvider(active) : SIMULATED_PROVIDER,
    providers,
    activeProviderId: active ? activeProviderId : SIMULATED_ID,
    githubToken: typeof settings?.githubToken === 'string' ? settings.githubToken : '',
    githubRepo: typeof settings?.githubRepo === 'string' ? settings.githubRepo : '',
  }
}

/** Coerce arbitrary parsed JSON into a valid AppState (defaults on bad shape). */
export function sanitizeState(parsed: any): AppState {
  const d = defaultState()
  if (!parsed || !Array.isArray(parsed.issues)) return d
  return {
    issues: parsed.issues,
    notifications: Array.isArray(parsed.notifications)
      ? parsed.notifications.filter((n: any) => n && typeof n.kind === 'string')
      : d.notifications,
    projects: Array.isArray(parsed.projects) ? parsed.projects : d.projects,
    theme: parsed.theme === 'light' ? 'light' : 'dark',
    locale: parsed.locale === 'en' ? 'en' : 'zh',
    agentTasks: Array.isArray(parsed.agentTasks) ? parsed.agentTasks : [],
    chats: Array.isArray(parsed.chats)
      ? parsed.chats.filter(
          (c: any) => c && typeof c.id === 'string' && Array.isArray(c.messages),
        )
      : [],
    settings: sanitizeSettings(parsed.settings),
    codebase:
      parsed.codebase && typeof parsed.codebase === 'object'
        ? { ...initialCodebase, ...parsed.codebase }
        : { ...initialCodebase },
  }
}

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return sanitizeState(JSON.parse(raw))
    // v1 → v2 migration: the old fake-team content is retired; carry over
    // only the user's real configuration (provider, GitHub, theme, locale).
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      const d = defaultState()
      d.settings = sanitizeSettings(parsed?.settings)
      d.theme = parsed?.theme === 'light' ? 'light' : 'dark'
      d.locale = parsed?.locale === 'en' ? 'en' : 'zh'
      window.localStorage.removeItem(LEGACY_KEY)
      return d
    }
    return defaultState()
  } catch {
    return defaultState()
  }
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

function saveState(state: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode / sandbox) — state lives in memory only.
  }
}

function notify(state: AppState, n: Notification): Notification[] {
  return [n, ...state.notifications].slice(0, 50)
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'updateIssue':
      return {
        ...state,
        issues: state.issues.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
      }
    case 'addIssue':
      return { ...state, issues: [action.issue, ...state.issues] }
    case 'moveIssue': {
      const { dragId, status, beforeId } = action
      const dragged = state.issues.find((i) => i.id === dragId)
      if (!dragged || dragId === beforeId) return state
      const rest = state.issues.filter((i) => i.id !== dragId)
      const updated = { ...dragged, status }
      let issues: Issue[]
      if (beforeId) {
        const idx = rest.findIndex((i) => i.id === beforeId)
        issues = idx >= 0 ? [...rest.slice(0, idx), updated, ...rest.slice(idx)] : [...rest, updated]
      } else {
        issues = [...rest, updated]
      }
      return { ...state, issues }
    }
    case 'readNotification':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, unread: false } : n,
        ),
      }
    case 'readAllNotifications':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, unread: false })),
      }
    case 'addProject':
      return { ...state, projects: [...state.projects, action.project] }
    case 'deleteProject':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        issues: state.issues.map((i) =>
          i.project === action.id ? { ...i, project: undefined } : i,
        ),
      }
    case 'setTheme':
      return { ...state, theme: action.theme }
    case 'setLocale':
      return { ...state, locale: action.locale }
    case 'delegate':
      return { ...state, agentTasks: [action.task, ...state.agentTasks] }
    case 'agentStep':
      return {
        ...state,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id ? { ...t, steps: [...t.steps, action.step] } : t,
        ),
      }
    case 'agentStatus': {
      const task = state.agentTasks.find((t) => t.id === action.id)
      const next = {
        ...state,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                status: action.status,
                summary: action.summary ?? t.summary,
                finishedAt:
                  action.status === 'needsReview' || action.status === 'done' || action.status === 'failed'
                    ? Date.now()
                    : t.finishedAt,
              }
            : t,
        ),
      }
      if (task && action.status === 'failed') {
        next.notifications = notify(state, {
          id: `n-${task.id}-failed-${Date.now()}`,
          kind: 'failed',
          title: task.title,
          issueId: task.issueId,
          taskId: task.id,
          detail: action.summary,
          time: Date.now(),
          unread: true,
        })
      }
      return next
    }
    case 'agentResult': {
      const task = state.agentTasks.find((t) => t.id === action.id)
      return {
        ...state,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                status: 'needsReview' as const,
                summary: action.summary,
                changes: action.changes,
                baseBranch: action.baseBranch ?? t.baseBranch,
                finishedAt: Date.now(),
              }
            : t,
        ),
        notifications: task
          ? notify(state, {
              id: `n-${task.id}-review`,
              kind: 'needsReview',
              title: task.title,
              issueId: task.issueId,
              taskId: task.id,
              time: Date.now(),
              unread: true,
            })
          : state.notifications,
      }
    }
    case 'applyChanges': {
      const task = state.agentTasks.find((t) => t.id === action.id)
      if (!task || task.status !== 'needsReview') return state
      const codebase = { ...state.codebase }
      for (const change of task.changes ?? []) {
        codebase[change.path] = change.after
      }
      return {
        ...state,
        codebase,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id ? { ...t, status: 'done' as const } : t,
        ),
        notifications: notify(state, {
          id: `n-${task.id}-applied`,
          kind: 'applied',
          title: task.title,
          issueId: task.issueId,
          taskId: task.id,
          time: Date.now(),
          unread: true,
        }),
      }
    }
    case 'githubApplied': {
      const task = state.agentTasks.find((t) => t.id === action.id)
      return {
        ...state,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id
            ? { ...t, status: 'done' as const, prUrl: action.prUrl, branch: action.branch }
            : t,
        ),
        notifications: task
          ? notify(state, {
              id: `n-${task.id}-pr`,
              kind: 'prCreated',
              title: task.title,
              issueId: task.issueId,
              taskId: task.id,
              detail: action.prUrl,
              time: Date.now(),
              unread: true,
            })
          : state.notifications,
      }
    }
    case 'retryTask': {
      // Retry re-evaluates the mode from CURRENT settings, so "fix the
      // config, then retry" works the way users expect.
      const githubMode = !!(state.settings.githubToken && state.settings.githubRepo)
      return {
        ...state,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id && t.status === 'failed'
            ? {
                ...t,
                status: 'queued' as const,
                steps: [],
                summary: undefined,
                changes: undefined,
                finishedAt: undefined,
                target: githubMode ? ('github' as const) : ('virtual' as const),
                repo: githubMode ? state.settings.githubRepo : undefined,
                baseBranch: undefined,
                branch: undefined,
                prUrl: undefined,
              }
            : t,
        ),
      }
    }
    case 'reviseTask':
      // A revision re-queues the task, keeping the previous summary and
      // changes in place — the engine hands them to the provider as the
      // "previous attempt" so the new round builds on review feedback.
      return {
        ...state,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id && t.status === 'needsReview'
            ? {
                ...t,
                status: 'queued' as const,
                steps: [],
                finishedAt: undefined,
                revisions: [
                  ...(t.revisions ?? []),
                  { instruction: action.instruction, time: Date.now() },
                ],
              }
            : t,
        ),
      }
    case 'newChat':
      return { ...state, chats: [action.thread, ...state.chats].slice(0, MAX_CHAT_THREADS) }
    case 'chatMessage':
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.threadId
            ? {
                ...c,
                // First user message names the thread.
                title:
                  c.title || (action.message.role === 'user' ? action.message.text.slice(0, 40) : c.title),
                messages: [...c.messages, action.message].slice(-MAX_CHAT_MESSAGES),
                updatedAt: action.message.time,
              }
            : c,
        ),
      }
    case 'setChatModel':
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.threadId ? { ...c, model: action.model } : c,
        ),
      }
    case 'deleteChat':
      return { ...state, chats: state.chats.filter((c) => c.id !== action.id) }
    case 'saveProviderProfile': {
      const exists = state.settings.providers.some((p) => p.id === action.profile.id)
      const providers = exists
        ? state.settings.providers.map((p) => (p.id === action.profile.id ? action.profile : p))
        : [...state.settings.providers, action.profile]
      // The first real provider replaces the simulator; editing the active
      // profile updates the runtime provider immediately.
      const activate =
        state.settings.activeProviderId === SIMULATED_ID ||
        state.settings.activeProviderId === action.profile.id
      return {
        ...state,
        settings: {
          ...state.settings,
          providers,
          activeProviderId: activate ? action.profile.id : state.settings.activeProviderId,
          provider: activate ? profileToProvider(action.profile) : state.settings.provider,
        },
      }
    }
    case 'deleteProviderProfile': {
      const wasActive = state.settings.activeProviderId === action.id
      return {
        ...state,
        settings: {
          ...state.settings,
          providers: state.settings.providers.filter((p) => p.id !== action.id),
          activeProviderId: wasActive ? SIMULATED_ID : state.settings.activeProviderId,
          provider: wasActive ? SIMULATED_PROVIDER : state.settings.provider,
        },
      }
    }
    case 'activateProvider': {
      if (action.id === SIMULATED_ID) {
        return {
          ...state,
          settings: { ...state.settings, activeProviderId: SIMULATED_ID, provider: SIMULATED_PROVIDER },
        }
      }
      const prof = state.settings.providers.find((p) => p.id === action.id)
      if (!prof) return state
      return {
        ...state,
        settings: { ...state.settings, activeProviderId: prof.id, provider: profileToProvider(prof) },
      }
    }
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'setProvider':
      return {
        ...state,
        settings: {
          ...state.settings,
          provider: { ...state.settings.provider, ...action.provider },
        },
      }
    case 'importState':
      return sanitizeState(action.data)
    case 'reset':
      // Reset clears demo/workspace data but keeps what is truly the
      // user's: settings, theme, locale — and their conversations.
      return {
        ...defaultState(),
        theme: state.theme,
        locale: state.locale,
        settings: state.settings,
        chats: state.chats,
      }
    default:
      return state
  }
}

export function nextIssueId(issues: Issue[]): string {
  const nums = issues.map((i) => parseInt(i.id.split('-')[1], 10)).filter((n) => !isNaN(n))
  return `LIN-${(nums.length ? Math.max(...nums) : 0) + 1}`
}

export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => saveState(state), [state])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])

  return { state, dispatch }
}
