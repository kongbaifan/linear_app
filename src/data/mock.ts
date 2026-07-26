// ─── Mock data for the Linear-style clone ────────────────────────

export type StatusKey = 'inProgress' | 'todo' | 'done' | 'backlog'
export type PriorityKey = 'urgent' | 'high' | 'medium' | 'low'

export interface User {
  name: string
  color: string
}

export const users: Record<string, User> = {
  karri: { name: 'karri', color: '#e5734d' },
  jori: { name: 'jori', color: '#b5a24a' },
  nan: { name: 'Nan', color: '#7a6ff0' },
  conor: { name: 'Conor', color: '#d16ba5' },
}

export interface Issue {
  id: string
  title: string
  status: StatusKey
  priority: PriorityKey
  labels: { name: string; color: string }[]
  assignee?: string
  date: string
  description?: string[]
}

export const issues: Issue[] = [
  {
    id: 'ENG-2703',
    title: 'Faster app launch',
    status: 'inProgress',
    priority: 'high',
    labels: [
      { name: 'Performance', color: '#4ea7fc' },
      { name: 'iOS', color: '#9ca0a8' },
    ],
    assignee: 'jori',
    date: 'Jul 26',
  },
  {
    id: 'ENG-2701',
    title: 'Ride receipts render blank on split fares',
    status: 'inProgress',
    priority: 'urgent',
    labels: [{ name: 'Bug', color: '#eb5757' }],
    assignee: 'karri',
    date: 'Jul 25',
  },
  {
    id: 'ENG-2694',
    title: 'Map camera drifts while driver is en route',
    status: 'inProgress',
    priority: 'medium',
    labels: [{ name: 'Maps', color: '#4cb782' }],
    assignee: 'nan',
    date: 'Jul 24',
  },
  {
    id: 'ENG-2712',
    title: 'Surge pricing banner overlaps safety toolkit',
    status: 'todo',
    priority: 'high',
    labels: [{ name: 'UI Refresh', color: '#26b5ce' }],
    date: 'Jul 26',
  },
  {
    id: 'ENG-2709',
    title: 'Add haptics to pickup confirmation',
    status: 'todo',
    priority: 'low',
    labels: [{ name: 'iOS', color: '#9ca0a8' }],
    assignee: 'conor',
    date: 'Jul 25',
  },
  {
    id: 'ENG-2705',
    title: 'Driver rating sheet: keyboard covers submit',
    status: 'todo',
    priority: 'medium',
    labels: [{ name: 'Bug', color: '#eb5757' }],
    date: 'Jul 24',
  },
  {
    id: 'ENG-2498',
    title: 'Dimmed Status Cards',
    status: 'done',
    priority: 'medium',
    labels: [{ name: 'UI Refresh', color: '#26b5ce' }],
    assignee: 'conor',
    date: 'Jul 22',
  },
  {
    id: 'ENG-2471',
    title: 'Consolidate ride history selectors',
    status: 'done',
    priority: 'low',
    labels: [{ name: 'Tech Debt', color: '#c678dd' }],
    assignee: 'nan',
    date: 'Jul 21',
  },
]

// ─── Activity feed for ENG-2703 ─────────────────────────────────

export type ActivityItem =
  | { kind: 'event'; icon: 'bot' | 'triage' | 'link' | 'sparkle' | 'status'; html: EventPart[]; time: string }
  | { kind: 'comments'; comments: { author: string; time: string; body: BodyPart[]; reply?: boolean }[] }
  | { kind: 'pr' }

export type EventPart =
  | { t: 'text'; s: string }
  | { t: 'strong'; s: string }
  | { t: 'chip'; s: string; color: string }

export type BodyPart = { t: 'text'; s: string } | { t: 'mention'; s: string }

export const eng2703Activity: ActivityItem[] = [
  {
    kind: 'event',
    icon: 'bot',
    html: [
      { t: 'strong', s: 'Linear' },
      { t: 'text', s: ' created the issue via Slack on behalf of ' },
      { t: 'strong', s: 'karri' },
    ],
    time: '2min ago',
  },
  {
    kind: 'event',
    icon: 'triage',
    html: [
      { t: 'strong', s: 'Triage Intelligence' },
      { t: 'text', s: ' added the label ' },
      { t: 'chip', s: 'Performance', color: '#4ea7fc' },
      { t: 'text', s: ' and ' },
      { t: 'chip', s: 'iOS', color: '#9ca0a8' },
    ],
    time: '2min ago',
  },
  {
    kind: 'comments',
    comments: [
      {
        author: 'karri',
        time: '4 min ago',
        body: [
          {
            t: 'text',
            s: 'Right now we show a spinner forever, which makes it look like the car disappeared...',
          },
        ],
      },
      {
        author: 'jori',
        time: 'just now',
        reply: true,
        body: [
          { t: 'mention', s: '@Linear' },
          { t: 'text', s: ' can you take a stab at this?' },
        ],
      },
    ],
  },
  {
    kind: 'event',
    icon: 'link',
    html: [
      { t: 'strong', s: 'Linear' },
      { t: 'text', s: ' connected by ' },
      { t: 'strong', s: 'jori' },
    ],
    time: '2 min ago',
  },
  { kind: 'pr' },
  {
    kind: 'event',
    icon: 'status',
    html: [
      { t: 'strong', s: 'Linear' },
      { t: 'text', s: ' moved from ' },
      { t: 'strong', s: 'Todo' },
      { t: 'text', s: ' to ' },
      { t: 'strong', s: 'In Progress' },
    ],
    time: 'just now',
  },
]

// ─── Diff data (ENG-2498 · Dimmed Status Cards) ─────────────────

export interface DiffLine {
  kind: 'context' | 'add' | 'del'
  no: number | null
  html: string
}

export interface DiffFile {
  name: string
  path: string
  added: number
  removed: number
  lines: DiffLine[]
}

const kw = (s: string) => `<span class="tok-kw">${s}</span>`
const ty = (s: string) => `<span class="tok-type">${s}</span>`
const fn = (s: string) => `<span class="tok-fn">${s}</span>`
const str = (s: string) => `<span class="tok-str">${s}</span>`
const cm = (s: string) => `<span class="tok-comment">${s}</span>`
const pr = (s: string) => `<span class="tok-prop">${s}</span>`
const pl = (s: string) => `<span class="tok-plain">${s}</span>`

export const diffFiles: DiffFile[] = [
  {
    name: 'useRideHistory.ts',
    path: 'client/src/views/RideHistory',
    added: 21,
    removed: 14,
    lines: [
      { kind: 'context', no: 76, html: '' },
      { kind: 'context', no: 77, html: cm('// Build sections from ride history state') },
      {
        kind: 'del',
        no: null,
        html: `${kw('const')} ${pl('dimmedIds')}: ${ty('Set')}&lt;${ty('string')}&gt; = ${fn('useComputed')}(() =&gt; {`,
      },
      {
        kind: 'del',
        no: null,
        html: `  ${kw('const')} ${pl('ids')} = ${kw('new')} ${ty('Set')}&lt;${ty('string')}&gt;();`,
      },
      {
        kind: 'del',
        no: null,
        html: `  ${kw('for')} (${kw('const')} ${pl('id')} ${kw('of')} ${pl('cancelledRideIds')}) {`,
      },
      { kind: 'del', no: null, html: `    ${pl('ids')}.${fn('add')}(${pl('id')});` },
      { kind: 'del', no: null, html: `  }` },
      {
        kind: 'add',
        no: 78,
        html: `${kw('const')} ${pl('waitingStatusById')}: ${ty('Map')}&lt;${ty('string')}, ${ty('string')}&gt; = ${fn('useComputed')}(() =&gt; {`,
      },
      {
        kind: 'add',
        no: 79,
        html: `  ${kw('const')} ${pl('map')} = ${kw('new')} ${ty('Map')}&lt;${ty('string')}, ${ty('string')}&gt;();`,
      },
      {
        kind: 'context',
        no: 80,
        html: `  ${kw('for')} (${kw('const')} ${pl('ride')} ${kw('of')} ${pl('ridesAwaitingPickup')}) {`,
      },
      { kind: 'del', no: null, html: `    ${pl('ids')}.${fn('add')}(${pl('ride')}.${pr('id')});` },
      {
        kind: 'add',
        no: 81,
        html: `    ${pl('map')}.${fn('set')}(${pl('ride')}.${pr('id')}, ${str('"Driver en route"')});`,
      },
      { kind: 'context', no: 82, html: `  }` },
      {
        kind: 'add',
        no: 83,
        html: `  ${kw('for')} (${kw('const')} ${pl('ride')} ${kw('of')} ${pl('ridesInProgress')}) {`,
      },
      {
        kind: 'add',
        no: 84,
        html: `    ${pl('map')}.${fn('set')}(${pl('ride')}.${pr('id')}, ${str('"Trip in progress"')});`,
      },
      { kind: 'add', no: 85, html: `  }` },
      { kind: 'context', no: 86, html: '' },
    ],
  },
  {
    name: 'RideHistoryPage.tsx',
    path: 'client/src/views/RideHistory',
    added: 2,
    removed: 1,
    lines: [
      {
        kind: 'context',
        no: 36,
        html: `${pr('background-color')}: \${${pl('props')}.${pr('theme')}.${pr('color')}.${pr('bgBase')}};`,
      },
      { kind: 'context', no: 37, html: `${pr('box-shadow')}: ${pl('none')};` },
      { kind: 'context', no: 38, html: '' },
      { kind: 'del', no: null, html: `${pr('opacity')}: \${${pl('props')}.${pr('dimmed')} ? ${pl('0.45')} : ${pl('1')}};` },
      { kind: 'add', no: 39, html: `${pr('opacity')}: ${pl('1')};` },
      { kind: 'add', no: 40, html: `\${${pl('props')}.${pr('highlighted')} &amp;&amp; ${fn('css')}\`` },
    ],
  },
]

// ─── Inbox notifications ────────────────────────────────────────

export interface Notification {
  id: string
  issueId: string
  issueTitle: string
  event: string
  actor?: string // key of users, undefined = Linear bot
  time: string
  unread: boolean
  kind: 'status' | 'comment' | 'mention' | 'label' | 'pr'
}

export const notifications: Notification[] = [
  {
    id: 'n1',
    issueId: 'ENG-2703',
    issueTitle: 'Faster app launch',
    event: 'Linear moved from Todo to In Progress',
    time: 'just now',
    unread: true,
    kind: 'status',
  },
  {
    id: 'n2',
    issueId: 'ENG-2703',
    issueTitle: 'Faster app launch',
    event: 'Draft PR awaiting your review — Changed 2 files',
    time: '2m',
    unread: true,
    kind: 'pr',
  },
  {
    id: 'n3',
    issueId: 'ENG-2498',
    issueTitle: 'Dimmed Status Cards',
    event: 'Nan commented: "Do we need both waitingStatusById and dimmedIds here?"',
    actor: 'nan',
    time: '18m',
    unread: true,
    kind: 'comment',
  },
  {
    id: 'n4',
    issueId: 'ENG-2703',
    issueTitle: 'Faster app launch',
    event: 'jori mentioned @Linear: "can you take a stab at this?"',
    actor: 'jori',
    time: '25m',
    unread: false,
    kind: 'mention',
  },
  {
    id: 'n5',
    issueId: 'ENG-2701',
    issueTitle: 'Ride receipts render blank on split fares',
    event: 'karri assigned you',
    actor: 'karri',
    time: '1h',
    unread: false,
    kind: 'status',
  },
  {
    id: 'n6',
    issueId: 'ENG-2703',
    issueTitle: 'Faster app launch',
    event: 'Triage Intelligence added labels Performance and iOS',
    time: '2h',
    unread: false,
    kind: 'label',
  },
  {
    id: 'n7',
    issueId: 'ENG-2471',
    issueTitle: 'Consolidate ride history selectors',
    event: 'Conor closed this issue as Done',
    actor: 'conor',
    time: '1d',
    unread: false,
    kind: 'status',
  },
]

// ─── Projects ───────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  icon: 'ui' | 'insights' | 'ride' | 'onboarding'
  color: string
  progress: number
  health: 'onTrack' | 'atRisk' | 'offTrack'
  lead: string
  target: string
  issueCount: number
}

export const projects: Project[] = [
  {
    id: 'p1',
    name: 'UI Refresh',
    icon: 'ui',
    color: '#26b5ce',
    progress: 72,
    health: 'onTrack',
    lead: 'conor',
    target: 'Aug 15',
    issueCount: 24,
  },
  {
    id: 'p2',
    name: 'Agents Insights',
    icon: 'insights',
    color: '#e5734d',
    progress: 41,
    health: 'onTrack',
    lead: 'nan',
    target: 'Sep 2',
    issueCount: 18,
  },
  {
    id: 'p3',
    name: 'Ride History v2',
    icon: 'ride',
    color: '#5e6ad2',
    progress: 88,
    health: 'atRisk',
    lead: 'jori',
    target: 'Jul 30',
    issueCount: 31,
  },
  {
    id: 'p4',
    name: 'Onboarding Revamp',
    icon: 'onboarding',
    color: '#4cb782',
    progress: 12,
    health: 'onTrack',
    lead: 'karri',
    target: 'Oct 1',
    issueCount: 9,
  },
]
