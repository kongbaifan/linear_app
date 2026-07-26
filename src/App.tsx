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
import ChatView from './components/ChatView'
import { useAgentEngine } from './agent/engine'
import { chatReply, type ChatTurn } from './agent/provider'
import type { Issue, StatusKey } from './data/mock'
import { statusOrder } from './components/meta'
import { useHashRoute, type View } from './router'
import { nextIssueId, serializeState, useAppStore, type AgentTask, type ChatMessage, type ChatThread } from './store'
import { applyToGitHub } from './agent/github'
import { I18nProvider, translate } from './i18n'

export type { View }

/** Chat transcript for the agent prompt, frozen at delegation time. */
function chatTranscript(thread: ChatThread, cap = 4000): string {
  const text = thread.messages
    .filter((m) => !m.error)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n')
  return text.length > cap ? `…${text.slice(-cap)}` : text
}

export default function App() {
  const { state, dispatch } = useAppStore()
  const [view, navigate] = useHashRoute()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStatus, setModalStatus] = useState<StatusKey>('todo')
  const [modalPrefill, setModalPrefill] = useState<{
    title?: string
    description?: string
    chatId?: string
  } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(state.issues[0]?.id ?? null)
  const [chatBusy, setChatBusy] = useState<string[]>([])
  const [chatStream, setChatStream] = useState<{ threadId: string; text: string } | null>(null)
  const chatAborts = useRef<Record<string, AbortController>>({})
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
    if (issue.chatId) {
      // Chat → task bridge: land on the new issue so delegating is one
      // click away, completing the "shape it, then hand it off" flow.
      navigate({ type: 'issue', id: issue.id })
    } else {
      // Stay in the current list mode (board keeps its context).
      navigate({ type: 'list', board: view.type === 'list' ? view.board : false })
    }
    setSelectedId(issue.id)
  }

  // Chat → task: prefill the new-issue modal from a conversation.
  const chatToTask = (thread: ChatThread) => {
    const lastUser = [...thread.messages].reverse().find((m) => m.role === 'user')?.text ?? ''
    setModalPrefill({
      title: thread.title || lastUser.slice(0, 40),
      description: lastUser && lastUser !== thread.title ? lastUser : undefined,
      chatId: thread.id,
    })
    setModalStatus('todo')
    setModalOpen(true)
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
        setModalStatus('todo')
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
    const srcChat = issue.chatId ? state.chats.find((c) => c.id === issue.chatId) : undefined
    dispatch({
      type: 'delegate',
      task: {
        id: `task-${Date.now()}`,
        issueId: issue.id,
        title: issue.title,
        description: issue.description,
        context: srcChat ? chatTranscript(srcChat) : undefined,
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

  // ─── Conversation mode ────────────────────────────────────────
  const sendChat = (threadId: string | null, text: string) => {
    const now = Date.now()
    const userMsg: ChatMessage = { id: `m-${now}`, role: 'user', text, time: now }
    let id = threadId
    let turns: ChatTurn[]
    if (!id) {
      id = `chat-${now}`
      dispatch({
        type: 'newChat',
        thread: { id, title: text.slice(0, 40), messages: [userMsg], createdAt: now, updatedAt: now },
      })
      navigate({ type: 'chat', id })
      turns = [{ role: 'user', text }]
    } else {
      dispatch({ type: 'chatMessage', threadId: id, message: userMsg })
      const thread = state.chats.find((c) => c.id === id)
      turns = [...(thread?.messages ?? []), userMsg].map((m) => ({ role: m.role, text: m.text }))
    }
    const provider = state.settings.provider
    const model =
      (threadId ? state.chats.find((c) => c.id === threadId)?.model : undefined) || provider.model
    const ctrl = new AbortController()
    chatAborts.current[id] = ctrl
    setChatBusy((b) => [...b, id!])
    chatReply({ ...provider, model }, turns, state.locale, {
      signal: ctrl.signal,
      onDelta: (text) => setChatStream({ threadId: id!, text }),
    })
      .then((reply) => {
        // Aborted before anything arrived → nothing to commit.
        if (!reply.trim()) return
        dispatch({
          type: 'chatMessage',
          threadId: id!,
          message: {
            id: `m-${Date.now()}`,
            role: 'assistant',
            text: reply,
            time: Date.now(),
            model: provider.kind === 'simulated' ? 'simulated' : model,
          },
        })
      })
      .catch((e) =>
        dispatch({
          type: 'chatMessage',
          threadId: id!,
          message: {
            id: `m-${Date.now()}`,
            role: 'assistant',
            text: `${translate(state.locale, 'chat.failed')}: ${e instanceof Error ? e.message : String(e)}`,
            time: Date.now(),
            error: true,
          },
        }),
      )
      .finally(() => {
        delete chatAborts.current[id!]
        setChatBusy((b) => b.filter((x) => x !== id))
        setChatStream((s) => (s?.threadId === id ? null : s))
      })
  }

  const stopChat = (threadId: string) => chatAborts.current[threadId]?.abort()

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
            onNewInStatus={(status) => {
              setModalStatus(status)
              setModalOpen(true)
            }}
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
              sourceChat={issue.chatId ? state.chats.find((c) => c.id === issue.chatId) : undefined}
              onOpenChat={(id) => navigate({ type: 'chat', id })}
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
            onRetry={(id) => dispatch({ type: 'retryTask', id })}
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
            onRetry={(id) => dispatch({ type: 'retryTask', id })}
            onOpenSettings={() => navigate({ type: 'settings' })}
          />
        )}
        {view.type === 'chat' && (
          <ChatView
            chats={state.chats}
            activeId={view.id}
            busy={chatBusy}
            provider={state.settings.provider}
            stream={chatStream}
            onOpen={(id) => navigate({ type: 'chat', id })}
            onNew={() => navigate({ type: 'chat' })}
            onSend={sendChat}
            onStop={stopChat}
            onToTask={chatToTask}
            onDelete={(id) => {
              dispatch({ type: 'deleteChat', id })
              if (view.id === id) navigate({ type: 'chat' })
            }}
            onSetModel={(threadId, model) => dispatch({ type: 'setChatModel', threadId, model })}
            onOpenSettings={() => navigate({ type: 'settings' })}
          />
        )}
        {view.type === 'settings' && (
          <SettingsView
            settings={state.settings}
            theme={state.theme}
            locale={state.locale}
            onSettings={(patch) => dispatch({ type: 'setSettings', settings: patch })}
            onSaveProfile={(profile) => dispatch({ type: 'saveProviderProfile', profile })}
            onDeleteProfile={(id) => dispatch({ type: 'deleteProviderProfile', id })}
            onActivate={(id) => dispatch({ type: 'activateProvider', id })}
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
              onRevise={(instruction) => dispatch({ type: 'reviseTask', id: task.id, instruction })}
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
            setModalStatus('todo')
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
          initialStatus={modalStatus}
          prefill={modalPrefill ?? undefined}
          onClose={() => {
            setModalOpen(false)
            setModalPrefill(null)
          }}
          onCreate={(p) => {
            addIssue(p)
            setModalOpen(false)
            setModalPrefill(null)
          }}
        />
      )}

    </div>
    </I18nProvider>
  )
}
