// Zero-dependency i18n: typed dictionaries + React context.
// UI chrome is translated; mock business content (issue titles, comments,
// activity events) intentionally stays in its original language, matching
// how a real workspace would look.
import { createContext, useContext, type ReactNode } from 'react'

export type Locale = 'en' | 'zh'

const en = {
  // sidebar
  'nav.inbox': 'Inbox',
  'nav.myIssues': 'My issues',
  'nav.reviews': 'Reviews',
  'nav.pulse': 'Pulse',
  'nav.workspace': 'Workspace',
  'nav.initiatives': 'Initiatives',
  'nav.projects': 'Projects',
  'nav.more': 'More',
  'nav.favorites': 'Favorites',
  'nav.agentTasks': 'Agent tasks',
  'nav.agentsInsights': 'Agents Insights',
  'action.search': 'Search',
  'action.newIssue': 'New issue',
  'action.toggleTheme': 'Toggle theme',
  'action.language': 'Language',

  // status / priority
  'status.inProgress': 'In Progress',
  'status.todo': 'Todo',
  'status.done': 'Done',
  'status.backlog': 'Backlog',
  'priority.urgent': 'Urgent',
  'priority.high': 'High',
  'priority.medium': 'Medium',
  'priority.low': 'Low',

  // list / board
  'list.filter': '+ Filter',
  'list.hint.navigate': 'navigate',
  'list.hint.open': 'open',
  'list.hint.new': 'new',
  'list.hint.commands': 'commands',
  'list.viewList': 'List',
  'list.viewBoard': 'Board',
  'board.dropHere': 'Drop issues here',

  // issue detail
  'issue.activity': 'Activity',
  'issue.leaveComment': 'Leave a comment…',
  'issue.labels': 'Labels',
  'issue.createdVia': 'Created via',
  'issue.unassigned': 'Unassigned',
  'issue.changeStatus': 'Change status…',
  'issue.changePriority': 'Change priority…',
  'issue.assignTo': 'Assign to…',
  'issue.noAssignee': 'No assignee',
  'issue.addLabels': 'Add labels…',

  // diff
  'diff.tab.activity': 'Activity',
  'diff.tab.guide': 'Guide',
  'diff.tab.diff': 'Diff',
  'diff.submitReview': 'Submit review',
  'diff.preview': 'Preview',

  // inbox
  'inbox.title': 'Inbox',
  'inbox.markAllRead': 'Mark all read',

  // projects
  'projects.title': 'Projects',
  'projects.new': 'New project',
  'projects.name': 'Name',
  'projects.progress': 'Progress',
  'projects.health': 'Health',
  'projects.lead': 'Lead',
  'projects.target': 'Target',
  'projects.issues': 'issues',
  'health.onTrack': 'On track',
  'health.atRisk': 'At risk',
  'health.offTrack': 'Off track',

  // command palette
  'palette.placeholder': 'Type a command or search…',
  'palette.noResults': 'No results',
  'palette.actions': 'Actions',
  'palette.navigation': 'Navigation',
  'palette.issues': 'Issues',
  'palette.createIssue': 'Create new issue…',
  'palette.goMyIssues': 'Go to My issues',
  'palette.goBoard': 'Go to Board',
  'palette.goInbox': 'Go to Inbox',
  'palette.goProjects': 'Go to Projects',
  'palette.goReviews': 'Go to Reviews',
  'palette.toLight': 'Switch to light theme',
  'palette.toDark': 'Switch to dark theme',
  'palette.language': 'Switch language / 切换语言',
  'palette.reset': 'Reset demo data',

  // new issue modal
  'modal.newIssue': 'New issue',
  'modal.titlePlaceholder': 'Issue title',
  'modal.descPlaceholder': 'Add description…',
  'modal.assignee': 'Assignee',
  'modal.labels': 'Labels',
  'modal.cancel': 'Cancel',
  'modal.create': 'Create issue',

  // agent panel
  'agent.workedFor': 'Worked for',
  'agent.inputPlaceholder': 'Tell Linear what to do next…',
  'agent.open': 'Open Linear agent',

  // agent workbench
  'agents.title': 'Agent tasks',
  'agents.empty': 'No agent tasks yet — open an issue and delegate it to the agent.',
  'agents.status.queued': 'Queued',
  'agents.status.working': 'Working',
  'agents.status.needsReview': 'Needs review',
  'agents.status.done': 'Done',
  'agents.status.failed': 'Failed',
  'agents.review': 'Review diff',
  'agents.settings': 'Agent settings',
  'agents.apiKey': 'Anthropic API key',
  'agents.apiKeyHint': 'Stored only in your browser. Leave empty to use the built-in simulator.',
  'agents.model': 'Model',
  'agents.save': 'Save',
  'agents.delegate': 'Delegate to Agent',
  'agents.working': 'Agent working…',
  'palette.goAgents': 'Go to Agent tasks',
}

export type MessageKey = keyof typeof en

const zh: Record<MessageKey, string> = {
  'nav.inbox': '收件箱',
  'nav.myIssues': '我的事项',
  'nav.reviews': '审查',
  'nav.pulse': '动态',
  'nav.workspace': '工作区',
  'nav.initiatives': '方向',
  'nav.projects': '项目',
  'nav.more': '更多',
  'nav.favorites': '收藏',
  'nav.agentTasks': 'Agent 任务',
  'nav.agentsInsights': 'Agents 洞察',
  'action.search': '搜索',
  'action.newIssue': '新建事项',
  'action.toggleTheme': '切换主题',
  'action.language': '语言',

  'status.inProgress': '进行中',
  'status.todo': '待办',
  'status.done': '已完成',
  'status.backlog': '待定',
  'priority.urgent': '紧急',
  'priority.high': '高',
  'priority.medium': '中',
  'priority.low': '低',

  'list.filter': '+ 筛选',
  'list.hint.navigate': '导航',
  'list.hint.open': '打开',
  'list.hint.new': '新建',
  'list.hint.commands': '命令',
  'list.viewList': '列表',
  'list.viewBoard': '看板',
  'board.dropHere': '拖拽事项到此处',

  'issue.activity': '活动',
  'issue.leaveComment': '写下评论…',
  'issue.labels': '标签',
  'issue.createdVia': '创建来源',
  'issue.unassigned': '未指派',
  'issue.changeStatus': '修改状态…',
  'issue.changePriority': '修改优先级…',
  'issue.assignTo': '指派给…',
  'issue.noAssignee': '无负责人',
  'issue.addLabels': '添加标签…',

  'diff.tab.activity': '活动',
  'diff.tab.guide': '指南',
  'diff.tab.diff': '差异',
  'diff.submitReview': '提交审查',
  'diff.preview': '预览',

  'inbox.title': '收件箱',
  'inbox.markAllRead': '全部标为已读',

  'projects.title': '项目',
  'projects.new': '新建项目',
  'projects.name': '名称',
  'projects.progress': '进度',
  'projects.health': '健康度',
  'projects.lead': '负责人',
  'projects.target': '目标',
  'projects.issues': '个事项',
  'health.onTrack': '正常',
  'health.atRisk': '有风险',
  'health.offTrack': '偏离',

  'palette.placeholder': '输入命令或搜索…',
  'palette.noResults': '无结果',
  'palette.actions': '操作',
  'palette.navigation': '导航',
  'palette.issues': '事项',
  'palette.createIssue': '新建事项…',
  'palette.goMyIssues': '前往我的事项',
  'palette.goBoard': '前往看板',
  'palette.goInbox': '前往收件箱',
  'palette.goProjects': '前往项目',
  'palette.goReviews': '前往审查',
  'palette.toLight': '切换到亮色主题',
  'palette.toDark': '切换到深色主题',
  'palette.language': '切换语言 / Switch language',
  'palette.reset': '重置演示数据',

  'modal.newIssue': '新建事项',
  'modal.titlePlaceholder': '事项标题',
  'modal.descPlaceholder': '添加描述…',
  'modal.assignee': '负责人',
  'modal.labels': '标签',
  'modal.cancel': '取消',
  'modal.create': '创建事项',

  'agent.workedFor': '已工作',
  'agent.inputPlaceholder': '告诉 Linear 接下来做什么…',
  'agent.open': '打开 Linear agent',

  'agents.title': 'Agent 任务',
  'agents.empty': '还没有 Agent 任务——打开一个事项,把它委派给 Agent 试试。',
  'agents.status.queued': '排队中',
  'agents.status.working': '工作中',
  'agents.status.needsReview': '待审查',
  'agents.status.done': '已完成',
  'agents.status.failed': '失败',
  'agents.review': '审查变更',
  'agents.settings': 'Agent 设置',
  'agents.apiKey': 'Anthropic API key',
  'agents.apiKeyHint': '仅保存在你的浏览器本地。留空则使用内置模拟引擎。',
  'agents.model': '模型',
  'agents.save': '保存',
  'agents.delegate': '委派给 Agent',
  'agents.working': 'Agent 工作中…',
  'palette.goAgents': '前往 Agent 任务',
}

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, zh }

export function translate(locale: Locale, key: MessageKey): string {
  return dictionaries[locale][key] ?? en[key] ?? key
}

interface I18nValue {
  locale: Locale
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18nValue>({ locale: 'en', t: (k) => en[k] ?? k })

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value: I18nValue = { locale, t: (key) => translate(locale, key) }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}
