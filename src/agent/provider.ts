// Agent provider abstraction.
// Providers return a work log plus STRUCTURED CODE EDITS (find/replace)
// against the virtual codebase. The engine resolves edits into concrete
// before/after file changes that render as reviewable diffs.
//
// - SimulatedProvider: default, no network — deterministic edits.
// - AnthropicProvider: real Claude API call from the browser (user's own
//   API key, stored locally; the engine falls back to simulation on error).

export interface AgentEdit {
  path: string
  find: string
  replace: string
}

export interface AgentRunInput {
  issueId: string
  title: string
  model: string
  apiKey?: string
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

// ─── Simulated provider ─────────────────────────────────────────

interface Playbook {
  match: RegExp
  steps: string[]
  summary: string
  edits: AgentEdit[]
}

const playbooks: Playbook[] = [
  {
    match: /launch|startup|perf/i,
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
    match: /dim|status card|opacity/i,
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
    match: /bug|blank|crash|fix|overlap|keyboard|receipt/i,
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
        'No API key configured — running in simulation mode',
      ],
      summary: `Simulation mode: proposed a marker edit in ${path}. Add an Anthropic API key in Agent settings to let Claude produce a real change.`,
      edits: [{ path, find: firstLine, replace: firstLine + marker }],
    }
  },
}

// ─── Anthropic provider (browser-direct) ────────────────────────

export const anthropicProvider: AgentProvider = {
  async run(input) {
    const files = Object.entries(input.codebase)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join('\n\n')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `You are a coding agent. Issue ${input.issueId}: "${input.title}".

Here is the codebase:

${files}

Make a focused change that addresses the issue. Respond with ONLY a JSON object:
{
  "steps": [4-6 short past-tense work-log lines],
  "summary": "1-2 sentence result summary",
  "edits": [{"path": "<exact file path>", "find": "<exact text copied verbatim from the file>", "replace": "<replacement text>"}]
}
Rules: "find" must be an EXACT substring of the file at "path" (copy it character-for-character, including indentation). Keep edits minimal. 1-3 edits max.`,
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    if (!Array.isArray(parsed.steps) || typeof parsed.summary !== 'string' || !Array.isArray(parsed.edits)) {
      throw new Error('bad response shape')
    }
    const edits: AgentEdit[] = parsed.edits
      .filter((e: AgentEdit) => e && typeof e.path === 'string' && typeof e.find === 'string')
      .map((e: AgentEdit) => ({ path: e.path, find: e.find, replace: String(e.replace ?? '') }))
    if (edits.length === 0) throw new Error('no valid edits')
    return { steps: parsed.steps.map(String), summary: parsed.summary, edits }
  },
}

export function pickProvider(apiKey?: string): AgentProvider {
  return apiKey ? anthropicProvider : simulatedProvider
}
