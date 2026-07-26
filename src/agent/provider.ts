// Agent provider abstraction.
// Providers return a work log plus STRUCTURED CODE EDITS (find/replace)
// against the codebase. The engine resolves edits into concrete
// before/after file changes that render as reviewable diffs.
//
// - simulated: default, no network — deterministic edits.
// - anthropic: Claude Messages API, custom base URL supported (relays).
// - openai:    any OpenAI-compatible /chat/completions endpoint —
//              OpenAI, DeepSeek, Kimi, GLM, Qwen, one-api relay stations, …
import type { ProviderKind, ProviderSettings } from '../store'

export interface AgentEdit {
  path: string
  find: string
  replace: string
}

export interface AgentRunInput {
  issueId: string
  title: string
  description?: string
  /** Prior chat transcript when the issue came from a conversation. */
  conversation?: string
  /** Review feedback: redo the work, building on the previous attempt. */
  revision?: {
    instruction: string
    previousSummary?: string
    previousFiles: { path: string; after: string }[]
  }
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
  const discussion = input.conversation
    ? `\n\nThis issue came out of a conversation with the user. Prior discussion (context — honor decisions made here):\n${input.conversation}`
    : ''
  const revision = input.revision
    ? `\n\nREVISION ROUND. Your previous attempt${
        input.revision.previousSummary ? ` (summary: "${input.revision.previousSummary}")` : ''
      } produced these file versions:\n${input.revision.previousFiles
        .map((f) => `--- ${f.path} (your previous result) ---\n${f.after}`)
        .join('\n\n')}\n\nThe user reviewed it and asks: "${input.revision.instruction}"\nProduce a NEW complete set of edits against the ORIGINAL codebase below that incorporates this feedback.`
    : ''
  return `You are a coding agent. Issue ${input.issueId}: "${input.title}".${details}${discussion}${revision}

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

/** Same-origin proxy path (Vercel serverless, see api/proxy.js) for relay
 *  stations that don't allow browser cross-origin calls. */
export const proxied = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`

const maybeProxied = (url: string, useProxy?: boolean) => (useProxy ? proxied(url) : url)

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

    // Revision round: re-run the playbook but visibly fold the feedback in,
    // so demo mode demonstrates the review loop honestly.
    if (input.revision) {
      const base = applicable ? pb : defaultPlaybook
      const marker = `\n// [revision] ${input.revision.instruction}`
      const edits = base.edits
        .filter((e) => input.codebase[e.path]?.includes(e.find))
        .map((e) => ({ ...e, replace: e.replace + marker }))
      if (edits.length > 0) {
        return {
          steps: [
            'Read the review feedback',
            `Applying revision: ${input.revision.instruction}`,
            'Updated the previous proposal',
            'Re-ran checks on the revised change',
          ],
          summary: `Revised per feedback: ${input.revision.instruction}`,
          edits,
        }
      }
    }

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

/** Anthropic-format endpoint URL — tolerates a base with or without /v1,
 *  so both `https://relay.example` and `https://relay.example/v1` work. */
export function anthropicMessagesUrl(baseUrl: string): string {
  const base = stripSlash(baseUrl || DEFAULT_ANTHROPIC_BASE).replace(/\/v1$/, '')
  return `${base}/v1/messages`
}

/** Anthropic-format auth headers. ccswitch-style relay stations are
 *  usually configured via ANTHROPIC_AUTH_TOKEN and only validate
 *  `Authorization: Bearer`; the official API wants `x-api-key`. For
 *  custom endpoints we send BOTH so either style of relay accepts it. */
export function anthropicHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
  if (stripSlash(baseUrl || DEFAULT_ANTHROPIC_BASE) !== DEFAULT_ANTHROPIC_BASE) {
    headers.authorization = `Bearer ${apiKey}`
  }
  return headers
}

export const anthropicProvider: AgentProvider = {
  async run(input) {
    const res = await fetch(
      maybeProxied(anthropicMessagesUrl(input.provider.baseUrl), input.provider.proxy),
      {
        method: 'POST',
        headers: anthropicHeaders(input.provider.apiKey, input.provider.baseUrl),
        body: JSON.stringify({
          model: input.provider.model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: buildPrompt(input) }],
        }),
      },
    )
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
    const res = await fetch(maybeProxied(`${base}/chat/completions`, input.provider.proxy), {
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

// ─── Plain-text chat (conversation mode) ────────────────────────
// The agent path above returns structured JSON edits; chat is the other
// posture — free-form text, you stay present. Same providers, no JSON.

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

const CHAT_SYSTEM =
  'You are the assistant inside Linage, a personal AI coding workbench. ' +
  'Be concise and concrete. Answer in the language the user writes in. ' +
  'When the user describes work that should become a trackable task, suggest phrasing it as an issue title plus a short description.'

/** Convenient model names for the in-chat picker; the configured model
 *  always appears first, these are just presets the user can ignore. */
export const MODEL_PRESETS: Record<ProviderKind, string[]> = {
  simulated: [],
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'kimi-k2', 'glm-4.6', 'qwen3-max'],
}

function simulatedReply(turns: ChatTurn[], locale: 'en' | 'zh'): string {
  const last = turns[turns.length - 1]?.text ?? ''
  const zh = locale === 'zh'
  const note = zh
    ? '\n\n——以上是内置模拟回复。在「设置 → AI 提供方」接入真实模型后，这里就是真正的 AI。'
    : '\n\n— This is a built-in simulated reply. Connect a real model under Settings → AI provider for actual answers.'
  if (/你好|您好|hello|^hi\b|嗨|在吗/i.test(last)) {
    return (
      (zh
        ? '你好！我是 Linage 的对话助手。你可以在这里提问、梳理思路，或把一个想法聊成一条可委派的任务。'
        : "Hi! I'm the Linage chat assistant. Ask questions, think out loud, or shape an idea into a delegatable task here.") + note
    )
  }
  if (/任务|委派|计划|下一步|优先|task|plan|todo|prioriti/i.test(last)) {
    return (
      (zh
        ? '按 Linage 的思路，值得把它拆成可委派的事项：标题写清目标，描述里给出上下文和边界，然后在「我的事项」里新建并委派给 Agent。聊清楚之后动手，比直接堆需求靠谱。'
        : 'The Linage way: break it into delegatable issues — a goal-shaped title plus a short description with context and boundaries. Create it under My issues and delegate it to the agent.') + note
    )
  }
  if (/代码|报错|函数|接口|code|bug|error|api|函数|正则/i.test(last)) {
    return (
      (zh
        ? '模拟模式下我读不到真实代码，也不会假装读得到。到「设置 → AI 提供方」接入 Anthropic 或任意 OpenAI 兼容端点（含中转站）后，把代码贴进来我就能真正分析。'
        : "In simulated mode I can't read real code — and won't pretend to. Connect Anthropic or any OpenAI-compatible endpoint (relays included) under Settings → AI provider, then paste the code here.") + note
    )
  }
  const topic = last.slice(0, 24)
  return (
    (zh
      ? `收到，你聊的是「${topic}${last.length > 24 ? '…' : ''}」。模拟模式只能接住话头，给不出真正的见解；配置真实模型后，这里就是一个完整的 AI 对话。`
      : `Got it — you're talking about "${topic}${last.length > 24 ? '…' : ''}". Simulated mode can hold the thread but not real insight; connect a real model and this becomes a full AI conversation.`) + note
  )
}

// SSE reader: feeds every `data: {...}` payload to onJson, stops on [DONE].
// Non-data lines (event:, comments, keep-alives) are ignored.
async function readSse(res: Response, onJson: (j: any) => void): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        onJson(JSON.parse(payload))
      } catch {
        // malformed keep-alive fragment — skip
      }
    }
  }
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal?.aborted) return abort()
    const t = setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        abort()
      },
      { once: true },
    )
  })

export interface ChatOpts {
  /** Called with the FULL accumulated text after every delta. */
  onDelta?: (text: string) => void
  /** Abort to stop generation; whatever already arrived is returned. */
  signal?: AbortSignal
}

/** One chat completion over the configured provider — streaming when the
 *  endpoint supports SSE, with a plain-JSON fallback for relays that
 *  ignore `stream: true`. Aborting resolves with the partial text. */
export async function chatReply(
  provider: ProviderSettings,
  turns: ChatTurn[],
  locale: 'en' | 'zh' = 'zh',
  opts: ChatOpts = {},
): Promise<string> {
  let acc = ''
  const emit = (piece: string) => {
    if (!piece) return
    acc += piece
    opts.onDelta?.(acc)
  }
  try {
    if (provider.kind === 'anthropic' && provider.apiKey) {
      const res = await fetch(maybeProxied(anthropicMessagesUrl(provider.baseUrl), provider.proxy), {
        method: 'POST',
        headers: anthropicHeaders(provider.apiKey, provider.baseUrl),
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 2048,
          stream: true,
          system: CHAT_SYSTEM,
          messages: turns.map((t) => ({ role: t.role, content: t.text })),
        }),
        signal: opts.signal,
      })
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`)
      if ((res.headers.get('content-type') ?? '').includes('event-stream')) {
        await readSse(res, (j) => {
          if (j.type === 'content_block_delta') emit(j.delta?.text ?? '')
        })
      } else {
        const data = await res.json()
        emit((data.content ?? []).map((b: { text?: string }) => b?.text ?? '').join(''))
      }
    } else if (provider.kind === 'openai' && provider.apiKey) {
      const base = stripSlash(provider.baseUrl || DEFAULT_OPENAI_BASE)
      const res = await fetch(maybeProxied(`${base}/chat/completions`, provider.proxy), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 2048,
          stream: true,
          messages: [
            { role: 'system', content: CHAT_SYSTEM },
            ...turns.map((t) => ({ role: t.role, content: t.text })),
          ],
        }),
        signal: opts.signal,
      })
      if (!res.ok) throw new Error(`OpenAI-compatible API ${res.status}`)
      if ((res.headers.get('content-type') ?? '').includes('event-stream')) {
        await readSse(res, (j) => emit(j.choices?.[0]?.delta?.content ?? ''))
      } else {
        const data = await res.json()
        emit(data.choices?.[0]?.message?.content ?? '')
      }
    } else {
      // Simulated: stream the canned reply in small pieces so the
      // conversation UI behaves exactly like a real streaming model.
      const text = simulatedReply(turns, locale)
      await wait(400, opts.signal)
      for (let i = 0; i < text.length; i += 5) {
        await wait(28, opts.signal)
        emit(text.slice(i, i + 5))
      }
    }
  } catch (e) {
    // User pressed stop — keep whatever arrived. Anything else is real.
    if ((e as Error)?.name === 'AbortError') return acc
    throw e
  }
  if (!acc) throw new Error('empty response')
  return acc
}
