// Shared status / priority metadata used by list, detail, palette and modal.
import type { PriorityKey, StatusKey } from '../data/mock'
import {
  PriorityHigh,
  PriorityLow,
  PriorityMedium,
  PriorityUrgent,
  StatusBacklog,
  StatusDone,
  StatusInProgress,
  StatusTodo,
} from './Icons'

export const statusMeta: Record<StatusKey, { label: string; icon: (size?: number) => React.ReactNode }> = {
  inProgress: { label: 'In Progress', icon: (size = 14) => <StatusInProgress size={size} /> },
  todo: { label: 'Todo', icon: (size = 14) => <StatusTodo size={size} /> },
  done: { label: 'Done', icon: (size = 14) => <StatusDone size={size} /> },
  backlog: { label: 'Backlog', icon: (size = 14) => <StatusBacklog size={size} /> },
}

export const statusOrder: StatusKey[] = ['inProgress', 'todo', 'done', 'backlog']

export const priorityMeta: Record<PriorityKey, { label: string; icon: (size?: number) => React.ReactNode }> = {
  urgent: { label: 'Urgent', icon: (size = 14) => <PriorityUrgent size={size} /> },
  high: { label: 'High', icon: (size = 14) => <PriorityHigh size={size} /> },
  medium: { label: 'Medium', icon: (size = 14) => <PriorityMedium size={size} /> },
  low: { label: 'Low', icon: (size = 14) => <PriorityLow size={size} /> },
}

export const priorityOrder: PriorityKey[] = ['urgent', 'high', 'medium', 'low']

export const allLabels: { name: string; color: string }[] = [
  { name: 'Performance', color: '#4ea7fc' },
  { name: 'iOS', color: '#9ca0a8' },
  { name: 'Bug', color: '#eb5757' },
  { name: 'Maps', color: '#4cb782' },
  { name: 'UI Refresh', color: '#26b5ce' },
  { name: 'Tech Debt', color: '#c678dd' },
]
