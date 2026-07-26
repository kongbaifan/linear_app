import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import IssueList from './components/IssueList'
import IssueDetail from './components/IssueDetail'
import DiffView from './components/DiffView'
import InboxView from './components/InboxView'
import ProjectsView from './components/ProjectsView'
import CommandPalette from './components/CommandPalette'
import NewIssueModal from './components/NewIssueModal'
import { FloatingAgentPanel } from './components/AgentPanel'
import AgentTasksView from './components/AgentTasksView'
import TaskDiffView from './components/TaskDiffView'
import SettingsModal from './components/SettingsModal'
import { useAgentEngine } from './agent/engine'
import type { Issue } from './data/mock'
import { statusOrder } from './components/meta'
import { useHashRoute, type View } from './router'
import { nextIssueId, useAppStore } from './store'
import { I18nProvider } from './i18n'

export type { View }

export default function App() {
  const { state, dispatch } = useAppStore()
  const [view, navigate] = useHashRoute()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(state.issues[0]?.id ?? null)

  const allIssues = state.issues

  // The flattened id order as rendered by the grouped list.
  const orderedIds = useMemo(
    () =>
      statusOrder.flatMap((status) =>
        allIssues.filter((i) => i.status === status).map((i) => i.id),
      ),
    [allIssues],
  )

  const addIssue = (partial: Omit<Issue, 'id' | 'date'>) => {
    const issue: Issue = { ...partial, id: nextIssueId(allIssues), date: 'Jul 26' }
    dispatch({ type: 'addIssue', issue })
    navigate({ type: 'list' })
    setSelectedId(issue.id)
  }

  // ─── Global keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  const delegateIssue = (issue: Issue) => {
    dispatch({
      type: 'delegate',
      task: {
        id: `task-${Date.now()}`,
        issueId: issue.id,
        title: issue.title,
        status: 'queued',
        model: state.settings.model,
        steps: [],
        createdAt: Date.now(),
      },
    })
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
        {view.type === 'issue' && (
          <IssueDetail
            issue={allIssues.find((i) => i.id === view.id) ?? allIssues[0]}
            onOpenDiff={(id) => navigate({ type: 'diff', id })}
            onUpdate={(patch) =>
              view.type === 'issue' && dispatch({ type: 'updateIssue', id: view.id, patch })
            }
            agentTask={state.agentTasks.find(
              (a) => a.issueId === view.id && a.status !== 'done' && a.status !== 'failed',
            )}
            onDelegate={delegateIssue}
            onViewAgent={() => navigate({ type: 'agents' })}
            onReviewTask={(taskId) => navigate({ type: 'task', id: taskId })}
          />
        )}
        {view.type === 'diff' && <DiffView onBack={() => navigate({ type: 'list' })} />}
        {view.type === 'inbox' && (
          <InboxView
            items={state.notifications}
            onRead={(id) => dispatch({ type: 'readNotification', id })}
            onReadAll={() => dispatch({ type: 'readAllNotifications' })}
            onOpenIssue={openIssue}
          />
        )}
        {view.type === 'projects' && <ProjectsView />}
        {view.type === 'agents' && (
          <AgentTasksView
            tasks={state.agentTasks}
            onOpenIssue={openIssue}
            onOpenTask={(id) => navigate({ type: 'task', id })}
            onApprove={(id) => dispatch({ type: 'applyChanges', id })}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        {view.type === 'task' && (() => {
          const task = state.agentTasks.find((a) => a.id === view.id)
          if (!task) return <div className="agents-empty">Task not found</div>
          return (
            <TaskDiffView
              task={task}
              onBack={() => navigate({ type: 'agents' })}
              onApprove={() => dispatch({ type: 'applyChanges', id: task.id })}
              onOpenIssue={openIssue}
            />
          )
        })()}
      </main>

      {view.type === 'issue' && view.id === 'ENG-2703' && (
        <FloatingAgentPanel onOpenDiff={() => navigate({ type: 'diff', id: 'ENG-2498' })} />
      )}

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
        <NewIssueModal onClose={() => setModalOpen(false)} onCreate={(p) => { addIssue(p); setModalOpen(false) }} />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={state.settings}
          onSave={(s) => dispatch({ type: 'setSettings', settings: s })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
    </I18nProvider>
  )
}
