import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import IssueList from './components/IssueList'
import IssueDetail from './components/IssueDetail'
import InboxView from './components/InboxView'
import ProjectsView from './components/ProjectsView'
import CommandPalette from './components/CommandPalette'
import NewIssueModal from './components/NewIssueModal'
import AgentTasksView from './components/AgentTasksView'
import TaskDiffView from './components/TaskDiffView'
import SettingsView from './components/SettingsView'
import { useAgentEngine } from './agent/engine'
import type { Issue } from './data/mock'
import { statusOrder } from './components/meta'
import { useHashRoute, type View } from './router'
import { nextIssueId, serializeState, useAppStore, type AgentTask } from './store'
import { applyToGitHub } from './agent/github'
import { I18nProvider } from './i18n'

export type { View }

export default function App() {
  const { state, dispatch } = useAppStore()
  const [view, navigate] = useHashRoute()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(state.issues[0]?.id ?? null)
  const installPrompt = useRef<any>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      installPrompt.current = e
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const allIssues = state.issues

  // The flattened id order as rendered by the grouped list.
  const orderedIds = useMemo(
    () =>
      statusOrder.flatMap((status) =>
        allIssues.filter((i) => i.status === status).map((i) => i.id),
      ),
    [allIssues],
  )

  const addIssue = (partial: Omit<Issue, 'id' | 'createdAt'>) => {
    const issue: Issue = { ...partial, id: nextIssueId(allIssues), createdAt: Date.now() }
    dispatch({ type: 'addIssue', issue })
    navigate({ type: 'list' })
    setSelectedId(issue.id)
  }

  // ─── Global keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        navigate({ type: 'settings' })
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setModalOpen(false)
        setPaletteOpen((o) => !o)
        return
      }
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (paletteOpen || modalOpen) return

      if (e.key === 'c') {
        e.preventDefault()
        setModalOpen(true)
        return
      }
      if (e.key === 'Escape' && view.type !== 'list') {
        navigate({ type: 'list' })
        return
      }
      if (view.type === 'list' && !view.board) {
        if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          const delta = e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1
          const idx = selectedId ? orderedIds.indexOf(selectedId) : -1
          const next = Math.min(Math.max(idx + delta, 0), orderedIds.length - 1)
          setSelectedId(orderedIds[next] ?? null)
          return
        }
        if (e.key === 'Enter' && selectedId) {
          e.preventDefault()
          navigate({ type: 'issue', id: selectedId })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, modalOpen, view, selectedId, orderedIds, navigate])

  const openIssue = (id: string) => {
    setSelectedId(id)
    navigate({ type: 'issue', id })
  }

  useAgentEngine(state, dispatch)

  const githubMode = !!(state.settings.githubToken && state.settings.githubRepo)

  const delegateIssue = (issue: Issue) => {
    dispatch({
      type: 'delegate',
      task: {
        id: `task-${Date.now()}`,
        issueId: issue.id,
        title: issue.title,
        description: issue.description,
        status: 'queued',
        model: state.settings.provider.kind === 'simulated' ? 'simulated' : state.settings.provider.model,
        steps: [],
        target: githubMode ? 'github' : 'virtual',
        repo: githubMode ? state.settings.githubRepo : undefined,
        createdAt: Date.now(),
      },
    })
  }

  const approveTask = (task: AgentTask) => {
    if (task.target !== 'github') {
      dispatch({ type: 'applyChanges', id: task.id })
      return
    }
    const branch = `linage/${task.id}`
    dispatch({ type: 'agentStatus', id: task.id, status: 'applying' })
    applyToGitHub(
      state.settings.githubToken,
      task.repo!,
      task.baseBranch ?? 'main',
      branch,
      task.changes ?? [],
      `Linage: ${task.title} (${task.issueId})`,
    )
      .then((prUrl) => dispatch({ type: 'githubApplied', id: task.id, prUrl, branch }))
      .catch((e) =>
        dispatch({
          type: 'agentStatus',
          id: task.id,
          status: 'failed',
          summary: `Push failed: ${e instanceof Error ? e.message : String(e)}`,
        }),
      )
  }

  const toggleTheme = () =>
    dispatch({ type: 'setTheme', theme: state.theme === 'dark' ? 'light' : 'dark' })

  const toggleLocale = () =>
    dispatch({ type: 'setLocale', locale: state.locale === 'en' ? 'zh' : 'en' })

  return (
    <I18nProvider locale={state.locale}>
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={navigate}
        theme={state.theme}
        onToggleTheme={toggleTheme}
        locale={state.locale}
        onToggleLocale={toggleLocale}
        onSetLocale={(lo) => dispatch({ type: 'setLocale', locale: lo })}
        onInstallApp={() => {
          const p = installPrompt.current
          if (p) {
            p.prompt()
            installPrompt.current = null
          } else {
            window.open('https://github.com/kongbaifan/linear_app', '_blank')
          }
        }}
      />
      <main className="main">
        {view.type === 'list' && (
          <IssueList
            issues={allIssues}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={openIssue}
            onMove={(dragId, status, beforeId) =>
              dispatch({ type: 'moveIssue', dragId, status, beforeId })
            }
            board={!!view.board}
            onToggleBoard={(board) => navigate({ type: 'list', board })}
          />
        )}
        {view.type === 'issue' && (() => {
          const issue = allIssues.find((i) => i.id === view.id) ?? allIssues[0]
          if (!issue) return <div className="agents-empty">—</div>
          return (
            <IssueDetail
              issue={issue}
              issueTasks={state.agentTasks.filter((a) => a.issueId === issue.id)}
              projects={state.projects}
              onUpdate={(patch) => dispatch({ type: 'updateIssue', id: issue.id, patch })}
              agentTask={state.agentTasks.find(
                (a) => a.issueId === issue.id && a.status !== 'done' && a.status !== 'failed',
              )}
              onDelegate={delegateIssue}
              onViewAgent={() => navigate({ type: 'agents' })}
              onReviewTask={(taskId) => navigate({ type: 'task', id: taskId })}
            />
          )
        })()}
        {view.type === 'reviews' && (
          <AgentTasksView
            tasks={state.agentTasks}
            reviewsOnly
            onOpenIssue={openIssue}
            onOpenTask={(id) => navigate({ type: 'task', id })}
            onApprove={(id) => {
              const task = state.agentTasks.find((a) => a.id === id)
              if (task) approveTask(task)
            }}
            onOpenSettings={() => navigate({ type: 'settings' })}
          />
        )}
        {view.type === 'inbox' && (
          <InboxView
            items={state.notifications}
            onRead={(id) => dispatch({ type: 'readNotification', id })}
            onReadAll={() => dispatch({ type: 'readAllNotifications' })}
            onOpenTask={(id) => navigate({ type: 'task', id })}
            onOpenIssue={openIssue}
            onOpenSettings={() => navigate({ type: 'settings' })}
          />
        )}
        {view.type === 'projects' && (
          <ProjectsView
            projects={state.projects}
            issues={allIssues}
            githubToken={state.settings.githubToken}
            githubRepo={state.settings.githubRepo}
            onAddProject={(proj) => dispatch({ type: 'addProject', project: proj })}
            onDeleteProject={(id) => dispatch({ type: 'deleteProject', id })}
            onSelectRepo={(fullName) => dispatch({ type: 'setSettings', settings: { githubRepo: fullName } })}
            onOpenSettings={() => navigate({ type: 'settings' })}
          />
        )}
        {view.type === 'agents' && (
          <AgentTasksView
            tasks={state.agentTasks}
            onOpenIssue={openIssue}
            onOpenTask={(id) => navigate({ type: 'task', id })}
            onApprove={(id) => {
              const task = state.agentTasks.find((a) => a.id === id)
              if (task) approveTask(task)
            }}
            onOpenSettings={() => navigate({ type: 'settings' })}
          />
        )}
        {view.type === 'settings' && (
          <SettingsView
            settings={state.settings}
            theme={state.theme}
            locale={state.locale}
            onSettings={(patch) => dispatch({ type: 'setSettings', settings: patch })}
            onProvider={(patch) => dispatch({ type: 'setProvider', provider: patch })}
            onTheme={(th) => dispatch({ type: 'setTheme', theme: th })}
            onLocale={(lo) => dispatch({ type: 'setLocale', locale: lo })}
            onExport={() => {
              const blob = new Blob([serializeState(state)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `linage-backup-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            onImport={(file) => {
              file.text().then((text) => {
                try {
                  dispatch({ type: 'importState', data: JSON.parse(text) })
                } catch {
                  // invalid file — ignore
                }
              })
            }}
            onReset={() => dispatch({ type: 'reset' })}
            storageBytes={serializeState(state).length}
          />
        )}
        {view.type === 'task' && (() => {
          const task = state.agentTasks.find((a) => a.id === view.id)
          if (!task) return <div className="agents-empty">Task not found</div>
          return (
            <TaskDiffView
              task={task}
              onBack={() => navigate({ type: 'agents' })}
              onApprove={() => approveTask(task)}
              onOpenIssue={openIssue}
            />
          )
        })()}
      </main>

      {paletteOpen && (
        <CommandPalette
          issues={allIssues}
          theme={state.theme}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(v) => {
            setPaletteOpen(false)
            navigate(v)
            if (v.type === 'issue') setSelectedId(v.id)
          }}
          onCreate={() => {
            setPaletteOpen(false)
            setModalOpen(true)
          }}
          onToggleTheme={() => {
            setPaletteOpen(false)
            toggleTheme()
          }}
          onToggleLocale={() => {
            setPaletteOpen(false)
            toggleLocale()
          }}
          onReset={() => {
            setPaletteOpen(false)
            dispatch({ type: 'reset' })
          }}
        />
      )}
      {modalOpen && (
        <NewIssueModal
          projects={state.projects}
          onClose={() => setModalOpen(false)}
          onCreate={(p) => { addIssue(p); setModalOpen(false) }}
        />
      )}

    </div>
    </I18nProvider>
  )
}
