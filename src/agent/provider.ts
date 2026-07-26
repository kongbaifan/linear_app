// Agent provider abstraction.
// - SimulatedProvider: default, no network — realistic canned playbooks.
// - AnthropicProvider: real Claude API call from the browser (requires the
//   user's own API key, stored locally; falls back to simulation on error).

export interface AgentRunInput {
  issueId: string
  title: string
  model: string
  apiKey?: string
}

export interface AgentRunResult {
  steps: string[]
  summary: string
}

export interface AgentProvider {
  /** Resolve the full plan; the engine animates steps onto the task. */
  run(input: AgentRunInput): Promise<AgentRunResult>
}

// ─── Simulated provider ─────────────────────────────────────────

const playbooks: { match: RegExp; steps: string[]; summary: string }[] = [
  {
    match: /launch|startup|perf/i,
    steps: [
      'Read client/src/startup/AppBoot.swift',
      'Traced vehicle_state sync in RideStore',
      'Identified blocking full-refresh call',
      'Rendered UI at minimum-required-state checkpoint',
      'Pushed branch and opened draft PR',
    ],
    summary: 'Startup no longer blocks on full vehicle_state refresh; UI renders once minimum state is present. Draft PR ready for review.',
  },
  {
    match: /bug|blank|crash|fix|overlap|keyboard/i,
    steps: [
      'Reproduced the issue locally',
      'Bisected to the offending commit',
      'Wrote a failing regression test',
      'Applied a minimal fix and re-ran the suite',
      'Pushed branch and opened draft PR',
    ],
    summary: 'Root cause isolated and fixed with a regression test guarding it. Draft PR ready for review.',
  },
]

const defaultPlaybook = {
  steps: [
    'Read the issue and related code paths',
    'Sketched an implementation plan',
    'Applied changes across affected files',
    'Ran build and existing tests',
    'Pushed branch and opened draft PR',
  ],
  summary: 'Implemented the requested change and opened a draft PR for review.',
}

export const simulatedProvider: AgentProvider = {
  async run(input) {
    const pb = playbooks.find((p) => p.match.test(input.title)) ?? defaultPlaybook
    return { steps: pb.steps, summary: pb.summary }
  },
}

// ─── Anthropic provider (browser-direct) ────────────────────────

export const anthropicProvider: AgentProvider = {
  async run(input) {
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
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are a coding agent working on issue ${input.issueId}: "${input.title}".
Respond with ONLY a JSON object, no prose: {"steps": [4-6 short past-tense work log lines], "summary": "1-2 sentence result summary ending with the PR being ready for review"}`,
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    if (!Array.isArray(parsed.steps) || typeof parsed.summary !== 'string') {
      throw new Error('bad response shape')
    }
    return { steps: parsed.steps.map(String), summary: parsed.summary }
  },
}

export function pickProvider(apiKey?: string): AgentProvider {
  return apiKey ? anthropicProvider : simulatedProvider
}
