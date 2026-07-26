// Centralized app store: useReducer + localStorage persistence.
// Storage access is wrapped in try/catch so the app still works in
// sandboxed environments where localStorage is unavailable.
import { useEffect, useReducer } from 'react'
import {
  issues as initialIssues,
  notifications as initialNotifications,
  type Issue,
  type Notification,
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
  status: AgentTaskStatus
  model: string
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

export type ProviderKind = 'simulated' | 'anthropic' | 'openai'

export interface ProviderSettings {
  kind: ProviderKind
  baseUrl: string
  apiKey: string
  model: string
}

export interface AgentSettings {
  provider: ProviderSettings
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
  theme: Theme
  locale: Locale
  agentTasks: AgentTask[]
  settings: AgentSettings
  codebase: Record<string, string>
}

export type Action =
  | { type: 'updateIssue'; id: string; patch: Partial<Issue> }
  | { type: 'addIssue'; issue: Issue }
  | { type: 'moveIssue'; dragId: string; status: StatusKey; beforeId?: string }
  | { type: 'readNotification'; id: string }
  | { type: 'readAllNotifications' }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'setLocale'; locale: Locale }
  | { type: 'delegate'; task: AgentTask }
  | { type: 'agentStep'; id: string; step: string }
  | { type: 'agentStatus'; id: string; status: AgentTaskStatus; summary?: string }
  | { type: 'agentResult'; id: string; summary: string; changes: FileChange[]; baseBranch?: string }
  | { type: 'applyChanges'; id: string }
  | { type: 'githubApplied'; id: string; prUrl: string; branch: string }
  | { type: 'setSettings'; settings: Partial<Omit<AgentSettings, 'provider'>> }
  | { type: 'setProvider'; provider: Partial<ProviderSettings> }
  | { type: 'importState'; data: unknown }
  | { type: 'reset' }

const STORAGE_KEY = 'linear-clone-state-v1'

function defaultState(): AppState {
  return {
    issues: initialIssues,
    notifications: initialNotifications,
    theme: 'dark',
    locale: 'en',
    agentTasks: [],
    settings: {
      provider: { kind: 'simulated', baseUrl: '', apiKey: '', model: '' },
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

/** Coerce arbitrary parsed JSON into a valid AppState (defaults on bad shape). */
export function sanitizeState(parsed: any): AppState {
  if (!parsed || !Array.isArray(parsed.issues) || !Array.isArray(parsed.notifications)) {
    return defaultState()
  }
  return {
    issues: parsed.issues,
    notifications: parsed.notifications,
    theme: parsed.theme === 'light' ? 'light' : 'dark',
    locale: parsed.locale === 'zh' ? 'zh' : 'en',
    agentTasks: Array.isArray(parsed.agentTasks) ? parsed.agentTasks : [],
    settings: {
      provider: sanitizeProvider(parsed.settings),
      githubToken: typeof parsed.settings?.githubToken === 'string' ? parsed.settings.githubToken : '',
      githubRepo: typeof parsed.settings?.githubRepo === 'string' ? parsed.settings.githubRepo : '',
    },
    codebase:
      parsed.codebase && typeof parsed.codebase === 'object'
        ? { ...initialCodebase, ...parsed.codebase }
        : { ...initialCodebase },
  }
}

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return sanitizeState(JSON.parse(raw))
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
    case 'agentStatus':
      return {
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
    case 'agentResult':
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
      }
    case 'githubApplied':
      return {
        ...state,
        agentTasks: state.agentTasks.map((t) =>
          t.id === action.id
            ? { ...t, status: 'done' as const, prUrl: action.prUrl, branch: action.branch }
            : t,
        ),
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
      return { ...defaultState(), theme: state.theme, locale: state.locale, settings: state.settings }
    default:
      return state
  }
}

export function nextIssueId(issues: Issue[]): string {
  const maxNum = Math.max(...issues.map((i) => parseInt(i.id.split('-')[1], 10)))
  return `ENG-${maxNum + 1}`
}

export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => saveState(state), [state])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])

  return { state, dispatch }
}
