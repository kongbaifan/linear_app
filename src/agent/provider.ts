// Agent provider abstraction.
// Providers return a work log plus STRUCTURED CODE EDITS (find/replace)
// against the codebase. The engine resolves edits into concrete
// before/after file changes that render as reviewable diffs.
//
// - simulated: default, no network — deterministic edits.
// - anthropic: Claude Messages API, custom base URL supported (relays).
// - openai:    any OpenAI-compatible /chat/completions endpoint —
//              OpenAI, DeepSeek, Kimi, GLM, Qwen, one-api relay stations, …
import type { ProviderSettings } from '../store'

export interface AgentEdit {
  path: string
  find: string
  replace: string
}

export interface AgentRunInput {
  issueId: string
  title: string
  description?: string
  provider: ProviderSettings
  codebase: Record<string, string>
}

export interface AgentRunResult {
  steps: string[]
  summary: string
  edits: AgentEdit[]
}

export interface AgentProvider {
  run(input: AgentRunInput): Promise<AgentRunResult>
}

// ─── Shared prompt / parsing ────────────────────────────────────

function buildPrompt(input: AgentRunInput): string {
  const files = Object.entries(input.codebase)
    .map(([path, content]) => `--- ${path} ---\n${content}`)
    .join('\n\n')
  const details = input.description ? `\nDetails: ${input.description}` : ''
  return `You are a coding agent. Issue ${input.issueId}: "${input.title}".${details}

Here is the codebase:

${files}

Make a focused change that addresses the issue. Respond with ONLY a JSON object:
{
  "steps": [4-6 short past-tense work-log lines],
  "summary": "1-2 sentence result summary",
  "edits": [{"path": "<exact file path>", "find": "<exact text copied verbatim from the file>", "replace": "<replacement text>"}]
}
Rules: "find" must be an EXACT substring of the file at "path" (copy it character-for-character, including indentation). Keep edits minimal. 1-3 edits max.`
}

function parseAgentJson(text: string): AgentRunResult {
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  if (!Array.isArray(parsed.steps) || typeof parsed.summary !== 'string' || !Array.isArray(parsed.edits)) {
    throw new Error('bad response shape')
  }
  const edits: AgentEdit[] = parsed.edits
    .filter((e: AgentEdit) => e && typeof e.path === 'string' && typeof e.find === 'string')
    .map((e: AgentEdit) => ({ path: e.path, find: e.find, replace: String(e.replace ?? '') }))
  if (edits.length === 0) throw new Error('no valid edits')
  return { steps: parsed.steps.map(String), summary: parsed.summary, edits }
}

const stripSlash = (u: string) => u.replace(/\/+$/, '')

// ─── Simulated provider ─────────────────────────────────────────

interface Playbook {
  match: RegExp
  steps: string[]
  summary: string
  edits: AgentEdit[]
}

const playbooks: Playbook[] = [
  {
    match: /launch|startup|perf|启动|性能/i,
    steps: [
      'Read client/src/startup/AppBoot.swift',
      'Traced vehicle_state sync in RideStore',
      'Identified blocking full-refresh call',
      'Rendered UI at minimum-required-state checkpoint',
      'Verified cold-start path locally',
    ],
    summary:
      'Startup no longer blocks on the full vehicle_state refresh; the UI renders once minimum required state is present and the full sync continues in the background.',
    edits: [
      {
        path: 'client/src/startup/AppBoot.swift',
        find: `        // Block until the full vehicle_state payload has been refreshed.
        store.refreshVehicleState(mode: .full)
        store.waitUntilSynced()

        window.rootViewController = HomeViewController(store: store)`,
        replace: `        // Render as soon as minimum required state is present;
        // finish the full vehicle_state refresh in the background.
        store.refreshVehicleState(mode: .minimum)

        window.rootViewController = HomeViewController(store: store)
        Task.detached(priority: .utility) {
            store.refreshVehicleState(mode: .full)
        }`,
      },
    ],
  },
  {
    match: /dim|status card|opacity|透明/i,
    steps: [
      'Read client/src/views/RideHistory',
      'Removed dimmed-row styling from ride cards',
      'Surfaced waiting status through the byline',
      'Re-ran visual snapshots',
    ],
    summary:
      'Ride cards no longer dim; waiting rides read their status from waitingStatusById via the card byline.',
    edits: [
      {
        path: 'client/src/views/RideHistory/RideHistoryPage.tsx',
        find: `  box-shadow: none;
  opacity: 1;`,
        replace: `  box-shadow: none;`,
      },
    ],
  },
  {
    match: /bug|blank|crash|fix|overlap|keyboard|receipt|修复|崩溃/i,
    steps: [
      'Reproduced the issue locally',
      'Bisected to the offending code path',
      'Wrote a failing regression test',
      'Applied a minimal guard and re-ran the suite',
    ],
    summary:
      'Root cause isolated and guarded with an early return; a regression test now covers the empty-section path.',
    edits: [
      {
        path: 'client/src/views/RideHistory/useRideHistory.ts',
        find: `  const sections: RideSection[] = useComputed(() => [
    { title: 'Active', rideIds: [...waitingStatusById.keys()] },
    { title: 'Past', rideIds: completedRides.map((r) => r.id) },
  ])`,
        replace: `  const sections: RideSection[] = useComputed(() =>
    [
      { title: 'Active', rideIds: [...waitingStatusById.keys()] },
      { title: 'Past', rideIds: completedRides.map((r) => r.id) },
    ].filter((section) => section.rideIds.length > 0),
  )`,
      },
    ],
  },
]

const defaultPlaybook: Playbook = {
  match: /./,
  steps: [
    'Read the issue and related code paths',
    'Sketched an implementation plan',
    'Applied changes across affected files',
    'Ran build and existing tests',
  ],
  summary: 'Implemented the requested change; see the diff for details.',
  edits: [
    {
      path: 'client/src/views/RideHistory/useRideHistory.ts',
      find: `// Build sections from ride history state`,
      replace: `// Build sections from ride history state
// NOTE: keep sections stable-sorted; ordering is part of the public contract.`,
    },
  ],
}

export const simulatedProvider: AgentProvider = {
  async run(input) {
    const pb = playbooks.find((p) => p.match.test(input.title)) ?? defaultPlaybook
    const applicable = pb.edits.some((e) => input.codebase[e.path]?.includes(e.find))
    if (applicable) return { steps: pb.steps, summary: pb.summary, edits: pb.edits }

    // Unknown codebase (e.g. a real GitHub repo without an API key):
    // make a deterministic, clearly-visible edit to the most central file.
    const paths = Object.keys(input.codebase)
    const path = paths.find((p) => /readme/i.test(p)) ?? paths[0]
    const content = input.codebase[path]
    const firstLine = content.split('\n')[0]
    const marker = path.endsWith('.md')
      ? `\n> Reviewed by Linage agent for ${input.issueId}: ${input.title}`
      : `\n// Linage agent (${input.issueId}): ${input.title} — starting point identified here.`
    return {
      steps: [
        `Scanned ${paths.length} files for relevant code`,
        `Selected ${path} as the entry point`,
        'Drafted a marker change for review',
        'No AI provider configured — running in simulation mode',
      ],
      summary: `Simulation mode: proposed a marker edit in ${path}. Configure an AI provider in Settings to get real changes.`,
      edits: [{ path, find: firstLine, replace: firstLine + marker }],
    }
  },
}

// ─── Anthropic (Claude) — custom base URL supported ─────────────

export const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com'

export const anthropicProvider: AgentProvider = {
  async run(input) {
    const base = stripSlash(input.provider.baseUrl || DEFAULT_ANTHROPIC_BASE)
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: input.provider.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(input) }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`)
    const data = await res.json()
    return parseAgentJson(data.content?.[0]?.text ?? '')
  },
}

// ─── OpenAI-compatible (relays / 中转站 / DeepSeek / Kimi / …) ──

export const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1'

export const openaiProvider: AgentProvider = {
  async run(input) {
    const base = stripSlash(input.provider.baseUrl || DEFAULT_OPENAI_BASE)
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.provider.apiKey}`,
      },
      body: JSON.stringify({
        model: input.provider.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(input) }],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI-compatible API ${res.status}`)
    const data = await res.json()
    return parseAgentJson(data.choices?.[0]?.message?.content ?? '')
  },
}

export function pickProvider(p: ProviderSettings): AgentProvider {
  if (p.kind === 'anthropic' && p.apiKey) return anthropicProvider
  if (p.kind === 'openai' && p.apiKey) return openaiProvider
  return simulatedProvider
}
