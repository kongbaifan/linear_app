// ─── Sample data for Linage (personal AI workbench) ─────────────
// There are exactly two actors: you ('me') and the agent ('agent').

export type StatusKey = 'inProgress' | 'todo' | 'done' | 'backlog'
export type PriorityKey = 'urgent' | 'high' | 'medium' | 'low'
export type ExecutorKey = 'me' | 'agent'

export interface Issue {
  id: string
  title: string
  status: StatusKey
  priority: PriorityKey
  labels: { name: string; color: string }[]
  executor: ExecutorKey
  project?: string
  description?: string
  notes?: IssueNote[]
  createdAt: number
  sample?: boolean
}

export interface IssueNote {
  id: string
  text: string
  time: number
}

export interface Project {
  id: string
  name: string
  color: string
  sample?: boolean
}

export type NotificationKind = 'welcome' | 'needsReview' | 'applied' | 'prCreated' | 'failed'

export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  issueId?: string
  taskId?: string
  detail?: string
  time: number
  unread: boolean
}

export const SAMPLE_PROJECT_ID = 'proj-sample'

export function sampleProjects(): Project[] {
  return [{ id: SAMPLE_PROJECT_ID, name: '上手 Linage', color: '#5e6ad2', sample: true }]
}

export function sampleIssues(): Issue[] {
  const now = Date.now()
  return [
    {
      id: 'LIN-1',
      title: '示例：优化 App 启动速度',
      status: 'todo',
      priority: 'high',
      labels: [{ name: '性能', color: '#4ea7fc' }],
      executor: 'agent',
      project: SAMPLE_PROJECT_ID,
      description:
        '内置虚拟代码库里的 AppBoot.swift 在启动时阻塞等待完整状态同步。试试点右侧「委派给 Agent」,看它如何改成最小状态先渲染、后台补全同步，然后审查它产出的 diff。',
      createdAt: now - 3600_000,
      sample: true,
    },
    {
      id: 'LIN-2',
      title: '示例：修复行程卡片透明度 Bug',
      status: 'todo',
      priority: 'medium',
      labels: [{ name: 'Bug', color: '#eb5757' }],
      executor: 'agent',
      project: SAMPLE_PROJECT_ID,
      description: '卡片样式里残留了一行多余的 opacity,应移除。这条也可以委派给 Agent 处理。',
      createdAt: now - 7200_000,
      sample: true,
    },
    {
      id: 'LIN-3',
      title: '示例：接入你的 GitHub 仓库和 AI 服务',
      status: 'todo',
      priority: 'low',
      labels: [{ name: '上手', color: '#26b5ce' }],
      executor: 'me',
      project: SAMPLE_PROJECT_ID,
      description:
        '打开 设置(Ctrl+,):在 AI 提供方里配置 Anthropic 或任意 OpenAI 兼容中转站;在 GitHub 区填入 token 和仓库。之后委派的任务将读取真实代码，批准后自动开分支提 PR。完成后可在设置里"重置演示数据"清掉这些示例。',
      createdAt: now - 10_800_000,
      sample: true,
    },
  ]
}

export function sampleNotifications(): Notification[] {
  return [
    {
      id: 'n-welcome',
      kind: 'welcome',
      title: '欢迎使用 Linage',
      time: Date.now() - 60_000,
      unread: true,
    },
  ]
}
