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

export type Theme = 'dark' | 'light'

export type AgentTaskStatus = 'queued' | 'working' | 'needsReview' | 'done' | 'failed'

export interface AgentTask {
  id: string
  issueId: string
  title: string
  status: AgentTaskStatus
  model: string
  steps: string[]
  summary?: string
  createdAt: number
  finishedAt?: number
}

export interface AgentSettings {
  apiKey: string
  model: string
}

export const DEFAULT_AGENT_MODEL = 'claude-sonnet-4-5'

export interface AppState {
  issues: Issue[]
  notifications: Notification[]
  theme: Theme
  locale: Locale
  agentTasks: AgentTask[]
  settings: AgentSettings
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
  | { type: 'setSettings'; settings: Partial<AgentSettings> }
  | { type: 'reset' }

const STORAGE_KEY = 'linear-clone-state-v1'

function defaultState(): AppState {
  return {
    issues: initialIssues,
    notifications: initialNotifications,
    theme: 'dark',
    locale: 'en',
    agentTasks: [],
    settings: { apiKey: '', model: DEFAULT_AGENT_MODEL },
  }
}

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.issues) || !Array.isArray(parsed.notifications)) {
      return defaultState()
    }
    return {
      issues: parsed.issues,
      notifications: parsed.notifications,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      locale: parsed.locale === 'zh' ? 'zh' : 'en',
      agentTasks: Array.isArray(parsed.agentTasks) ? parsed.agentTasks : [],
      settings: {
        apiKey: typeof parsed.settings?.apiKey === 'string' ? parsed.settings.apiKey : '',
        model: typeof parsed.settings?.model === 'string' ? parsed.settings.model : DEFAULT_AGENT_MODEL,
      },
    }
  } catch {
    return defaultState()
  }
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
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } }
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
