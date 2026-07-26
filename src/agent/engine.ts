// Agent execution engine: watches the task queue and drives each queued
// task through working → needsReview, animating step lines as they land.
import { useEffect, useRef } from 'react'
import type { Action, AppState } from '../store'
import { pickProvider, simulatedProvider } from './provider'

const STEP_DELAY_MS = 1300

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
        let result
        try {
          result = await pickProvider(state.settings.apiKey || undefined).run({
            issueId: task.issueId,
            title: task.title,
            model: state.settings.model,
            apiKey: state.settings.apiKey || undefined,
          })
        } catch {
          // Real API unreachable / bad key — degrade gracefully.
          result = await simulatedProvider.run({
            issueId: task.issueId,
            title: task.title,
            model: state.settings.model,
          })
        }
        for (const step of result.steps) {
          await new Promise((r) => setTimeout(r, STEP_DELAY_MS))
          dispatch({ type: 'agentStep', id: task.id, step })
        }
        await new Promise((r) => setTimeout(r, 600))
        dispatch({
          type: 'agentStatus',
          id: task.id,
          status: 'needsReview',
          summary: result.summary,
        })
        running.current.delete(task.id)
      })()
    })
  }, [state.agentTasks, state.settings, dispatch])
}
