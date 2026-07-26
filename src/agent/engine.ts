// Agent execution engine: drives queued tasks through working → needsReview,
// animating step lines, then resolving the provider's structured edits into
// concrete before/after file changes for diff review.
import { useEffect, useRef } from 'react'
import type { Action, AppState, FileChange } from '../store'
import {
  TEMPLATE_INSTRUCTIONS,
  pickProvider,
  selectFiles,
  simulatedProvider,
  type AgentEdit,
} from './provider'
import { fetchFilesByPath, fetchRepoFiles, fetchRepoTree } from './github'

const STEP_DELAY_MS = 1300

/** Apply find/replace edits to the current codebase → before/after per file. */
function resolveEdits(codebase: Record<string, string>, edits: AgentEdit[], taskId: string): FileChange[] {
  const after: Record<string, string> = {}
  for (const edit of edits) {
    const current = after[edit.path] ?? codebase[edit.path]
    if (current === undefined) continue
    if (current.includes(edit.find)) {
      after[edit.path] = current.replace(edit.find, edit.replace)
    }
  }
  const changes = Object.entries(after)
    .filter(([path, next]) => next !== codebase[path])
    .map(([path, next]) => ({ path, before: codebase[path], after: next }))

  if (changes.length === 0) {
    // Nothing applied cleanly (e.g. the file already changed) — leave an
    // honest trace instead of an empty diff.
    const path = Object.keys(codebase)[0]
    return [
      {
        path,
        before: codebase[path],
        after: codebase[path] + `\n// TODO(${taskId}): edits did not apply cleanly; needs manual follow-up\n`,
      },
    ]
  }
  return changes
}

export function useAgentEngine(state: AppState, dispatch: React.Dispatch<Action>) {
  const running = useRef<Set<string>>(new Set())

  // Tasks stuck in 'working' after a reload get re-queued once.
  useEffect(() => {
    state.agentTasks
      .filter((t) => t.status === 'working' && !running.current.has(t.id))
      .forEach((t) => dispatch({ type: 'agentStatus', id: t.id, status: 'queued' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const queued = state.agentTasks.filter(
      (t) => t.status === 'queued' && !running.current.has(t.id),
    )
    queued.forEach((task) => {
      running.current.add(task.id)
      dispatch({ type: 'agentStatus', id: task.id, status: 'working' })
      ;(async () => {
        let codebase = { ...state.codebase }
        let baseBranch: string | undefined
        if (task.target === 'github' && task.repo) {
          dispatch({ type: 'agentStep', id: task.id, step: `Connecting to ${task.repo}…` })
          const realProvider =
            state.settings.provider.kind !== 'simulated' && !!state.settings.provider.apiKey
          try {
            if (realProvider) {
              // Two-round retrieval: show the model the tree, let it name
              // the files it needs, then fetch exactly those.
              const tree = await fetchRepoTree(state.settings.githubToken, task.repo)
              baseBranch = tree.baseBranch
              dispatch({
                type: 'agentStep',
                id: task.id,
                step: `Listed ${tree.paths.length} candidate files in ${task.repo}@${baseBranch}`,
              })
              try {
                const wanted = await selectFiles(
                  state.settings.provider,
                  {
                    issueId: task.issueId,
                    title: task.title,
                    description: task.description,
                    conversation: task.context,
                  },
                  tree.paths,
                )
                dispatch({
                  type: 'agentStep',
                  id: task.id,
                  step: `Model requested ${wanted.length} files: ${wanted.slice(0, 3).join(', ')}${wanted.length > 3 ? ', …' : ''}`,
                })
                codebase = await fetchFilesByPath(
                  state.settings.githubToken,
                  task.repo,
                  baseBranch,
                  wanted,
                )
                if (Object.keys(codebase).length === 0) throw new Error('selected files unreadable')
              } catch (selErr) {
                // Selection round failed — degrade honestly to the scan.
                dispatch({
                  type: 'agentStep',
                  id: task.id,
                  step: `⚠ File selection failed (${selErr instanceof Error ? selErr.message : String(selErr)}) — falling back to relevance scan`,
                })
                const fetched = await fetchRepoFiles(
                  state.settings.githubToken,
                  task.repo,
                  `${task.title} ${task.description ?? ''}`,
                )
                codebase = fetched.codebase
                baseBranch = fetched.baseBranch
              }
            } else {
              const fetched = await fetchRepoFiles(
                state.settings.githubToken,
                task.repo,
                `${task.title} ${task.description ?? ''}`,
              )
              codebase = fetched.codebase
              baseBranch = fetched.baseBranch
            }
            dispatch({
              type: 'agentStep',
              id: task.id,
              step: `Fetched ${Object.keys(codebase).length} files from ${task.repo}@${baseBranch}`,
            })
          } catch (e) {
            dispatch({
              type: 'agentStatus',
              id: task.id,
              status: 'failed',
              summary: `Could not read ${task.repo}: ${e instanceof Error ? e.message : String(e)}`,
            })
            running.current.delete(task.id)
            return
          }
        }
        // Context visibility: record exactly what the model gets to see.
        dispatch({ type: 'agentContext', id: task.id, files: Object.keys(codebase) })
        const lastRevision = task.revisions?.[task.revisions.length - 1]
        const input = {
          issueId: task.issueId,
          title: task.title,
          description: task.description,
          conversation: task.context,
          guidance: task.template ? TEMPLATE_INSTRUCTIONS[task.template] : undefined,
          revision:
            lastRevision && task.changes?.length
              ? {
                  instruction: lastRevision.instruction,
                  previousSummary: task.summary,
                  previousFiles: task.changes.map((c) => ({
                    path: c.path,
                    after: c.after.length > 3000 ? `${c.after.slice(0, 3000)}\n…(truncated)` : c.after,
                  })),
                }
              : undefined,
          provider: state.settings.provider,
          codebase,
        }
        let result
        try {
          result = await pickProvider(state.settings.provider).run(input)
        } catch (e) {
          // Real API unreachable / bad key / bad response — degrade gracefully,
          // but say so honestly instead of passing simulation off as real output.
          const reason = e instanceof Error ? e.message : String(e)
          result = await simulatedProvider.run(input)
          result = {
            ...result,
            steps: [`⚠ ${state.settings.provider.kind} provider failed (${reason}) — fell back to simulation`, ...result.steps],
            summary: `[Simulated fallback — ${state.settings.provider.kind} call failed: ${reason}] ${result.summary}`,
          }
        }
        for (const step of result.steps) {
          await new Promise((r) => setTimeout(r, STEP_DELAY_MS))
          dispatch({ type: 'agentStep', id: task.id, step })
        }
        await new Promise((r) => setTimeout(r, 600))
        dispatch({
          type: 'agentResult',
          id: task.id,
          summary: result.summary,
          changes: resolveEdits(codebase, result.edits, task.id),
          baseBranch,
        })
        running.current.delete(task.id)
      })()
    })
  }, [state.agentTasks, state.settings, state.codebase, dispatch])
}
