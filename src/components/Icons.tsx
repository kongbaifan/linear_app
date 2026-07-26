// Compact inline SVG icon set, approximating Linear's iconography.
import type { CSSProperties } from 'react'

type P = { size?: number; color?: string; style?: CSSProperties; className?: string }

const S = ({ size = 16, children, viewBox = '0 0 16 16', ...rest }: P & { children: React.ReactNode; viewBox?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={rest.style}
    className={rest.className}
    color={rest.color}
  >
    {children}
  </svg>
)

export const LinearLogo = ({ size = 12 }: P) => (
  <S size={size} viewBox="0 0 100 100">
    <path
      fill="currentColor"
      d="M1.22 61.52a2 2 0 0 1 .52-1.9l35.64 35.64a2 2 0 0 1-1.9.52A50.06 50.06 0 0 1 1.22 61.52ZM.02 46.89a2 2 0 0 0 .58 1.55l50.96 50.96a2 2 0 0 0 1.55.58 49.8 49.8 0 0 0 12.5-2.72 2 2 0 0 0 .72-3.3L5.05 32.95a2 2 0 0 0-3.3.72A49.8 49.8 0 0 0 .02 46.9ZM4.21 25.98a2 2 0 0 0 .36 2.34l67.11 67.11a2 2 0 0 0 2.34.36 50.25 50.25 0 0 0 9.17-6.29 2 2 0 0 0 .1-2.92L10.42 16.71a2 2 0 0 0-2.92.1 50.25 50.25 0 0 0-6.29 9.17ZM14.85 11.14a2 2 0 0 1-.09-2.91A49.85 49.85 0 0 1 50 0c27.61 0 50 22.39 50 50a49.85 49.85 0 0 1-8.23 27.24 2 2 0 0 1-2.91-.09L14.85 11.14Z"
    />
  </S>
)

export const Search = ({ size = 15 }: P) => (
  <S size={size}>
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </S>
)

export const Compose = ({ size = 15 }: P) => (
  <S size={size}>
    <path d="M8 2.5H4a2 2 0 0 0-2 2V12a2 2 0 0 0 2 2h7.5a2 2 0 0 0 2-2V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M13.3 2.7a1.4 1.4 0 0 1 0 2L8.6 9.4l-2.6.6.6-2.6 4.7-4.7a1.4 1.4 0 0 1 2 0Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </S>
)

export const Inbox = ({ size = 15 }: P) => (
  <S size={size}>
    <path
      d="M2 9.5V11a2.5 2.5 0 0 0 2.5 2.5h7A2.5 2.5 0 0 0 14 11V9.5M2 9.5 3.6 3.9A2 2 0 0 1 5.5 2.5h5a2 2 0 0 1 1.9 1.4L14 9.5M2 9.5h3l.6 1.2a1.5 1.5 0 0 0 1.3.8h2.2a1.5 1.5 0 0 0 1.3-.8l.6-1.2h3"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </S>
)

export const MyIssues = ({ size = 15 }: P) => (
  <S size={size}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 8.2 7.2 10 10.5 6.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const Reviews = ({ size = 15 }: P) => (
  <S size={size}>
    <path d="M5 3.5v9M5 3.5 3 5.5M5 3.5l2 2M11 12.5v-9M11 12.5l-2-2M11 12.5l2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const Pulse = ({ size = 15 }: P) => (
  <S size={size}>
    <path d="M1.5 8h3l1.8-4.5L9.7 12l1.8-4h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const Initiatives = ({ size = 15 }: P) => (
  <S size={size}>
    <circle cx="8" cy="8" r="2" fill="currentColor" />
    <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.4 2.2" />
  </S>
)

export const Projects = ({ size = 15 }: P) => (
  <S size={size}>
    <path d="m8 1.8 5.4 3.1v6.2L8 14.2l-5.4-3.1V4.9L8 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M8 8v6M8 8 2.8 5M8 8l5.2-3" stroke="currentColor" strokeWidth="1.1" />
  </S>
)

export const More = ({ size = 15 }: P) => (
  <S size={size}>
    <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
  </S>
)

export const ChevronDown = ({ size = 12 }: P) => (
  <S size={size} className="chevron">
    <path d="m4 6.2 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const ChevronUp = ({ size = 13 }: P) => (
  <S size={size}>
    <path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const Star = ({ size = 13, filled = true }: P & { filled?: boolean }) => (
  <S size={size}>
    <path
      d="m8 1.6 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.6Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </S>
)

export const Dots = ({ size = 14 }: P) => (
  <S size={size}>
    <circle cx="3.5" cy="8" r="1.1" fill="currentColor" />
    <circle cx="8" cy="8" r="1.1" fill="currentColor" />
    <circle cx="12.5" cy="8" r="1.1" fill="currentColor" />
  </S>
)

export const LinkIcon = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="M6.5 9.5 9.5 6.5M7.5 4.5l1-1a2.83 2.83 0 0 1 4 4l-1 1M8.5 11.5l-1 1a2.83 2.83 0 0 1-4-4l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </S>
)

export const CopyIcon = ({ size = 14 }: P) => (
  <S size={size}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
    <path d="M10.5 3.5v-.2A1.8 1.8 0 0 0 8.7 1.5H4.3a1.8 1.8 0 0 0-1.8 1.8v4.4a1.8 1.8 0 0 0 1.8 1.8h.2" stroke="currentColor" strokeWidth="1.3" />
  </S>
)

export const GitBranch = ({ size = 14 }: P) => (
  <S size={size}>
    <circle cx="4.5" cy="3.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="4.5" cy="12.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="11.5" cy="5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4.5 5.1v5.8M11.5 6.6c0 2.5-3 2.6-5 3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </S>
)

/* Status icons */
export const StatusInProgress = ({ size = 14 }: P) => (
  <S size={size} color="#f2c94c">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 8V4.4a3.6 3.6 0 0 1 0 7.2V8Z" fill="currentColor" />
    <path d="M8 8H4.4a3.6 3.6 0 0 1 3.6-3.6V8Z" fill="currentColor" />
  </S>
)

export const StatusTodo = ({ size = 14 }: P) => (
  <S size={size} color="#8a8f98">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
  </S>
)

export const StatusBacklog = ({ size = 14 }: P) => (
  <S size={size} color="#62666d">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 2.4" />
  </S>
)

export const StatusDone = ({ size = 14 }: P) => (
  <S size={size} color="#4cb782">
    <circle cx="8" cy="8" r="7" fill="currentColor" />
    <path d="m5.1 8.3 2 2 3.8-4.3" stroke="#0d0e10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

/* Priority icons */
export const PriorityHigh = ({ size = 14 }: P) => (
  <S size={size} color="#9ca0a8">
    <rect x="2" y="9" width="2.6" height="5" rx="1" fill="currentColor" />
    <rect x="6.7" y="6" width="2.6" height="8" rx="1" fill="currentColor" />
    <rect x="11.4" y="3" width="2.6" height="11" rx="1" fill="currentColor" />
  </S>
)

export const PriorityMedium = ({ size = 14 }: P) => (
  <S size={size} color="#9ca0a8">
    <rect x="2" y="9" width="2.6" height="5" rx="1" fill="currentColor" />
    <rect x="6.7" y="6" width="2.6" height="8" rx="1" fill="currentColor" />
    <rect x="11.4" y="3" width="2.6" height="11" rx="1" fill="currentColor" opacity="0.3" />
  </S>
)

export const PriorityLow = ({ size = 14 }: P) => (
  <S size={size} color="#9ca0a8">
    <rect x="2" y="9" width="2.6" height="5" rx="1" fill="currentColor" />
    <rect x="6.7" y="6" width="2.6" height="8" rx="1" fill="currentColor" opacity="0.3" />
    <rect x="11.4" y="3" width="2.6" height="11" rx="1" fill="currentColor" opacity="0.3" />
  </S>
)

export const PriorityUrgent = ({ size = 14 }: P) => (
  <S size={size} color="#fc7840">
    <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" />
    <path d="M8 4.5v4" stroke="#101012" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="11" r="1" fill="#101012" />
  </S>
)

export const Sparkle = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="M8 2.2 9.3 6 13 7.3 9.3 8.6 8 12.4 6.7 8.6 3 7.3 6.7 6 8 2.2Z" fill="currentColor" opacity="0.85" />
    <path d="M12.8 10.8 13.4 12.4 15 13l-1.6.6-.6 1.6-.6-1.6L10.6 13l1.6-.6.6-1.6Z" fill="currentColor" opacity="0.6" />
  </S>
)

export const SlackMark = ({ size = 13 }: P) => (
  <S size={size} viewBox="0 0 24 24">
    <path d="M9.04 15.17a1.9 1.9 0 1 1-1.9-1.9h1.9v1.9ZM9.99 15.17a1.9 1.9 0 0 1 3.8 0v4.75a1.9 1.9 0 1 1-3.8 0v-4.75Z" fill="currentColor" opacity=".85" />
    <path d="M8.85 9.04a1.9 1.9 0 1 1 1.9-1.9v1.9h-1.9ZM8.85 9.99a1.9 1.9 0 0 1 0 3.8H4.1a1.9 1.9 0 1 1 0-3.8h4.75Z" fill="currentColor" opacity=".65" />
    <path d="M14.96 8.85a1.9 1.9 0 1 1 1.9 1.9h-1.9v-1.9ZM14.01 8.85a1.9 1.9 0 0 1-3.8 0V4.1a1.9 1.9 0 1 1 3.8 0v4.75Z" fill="currentColor" opacity=".75" />
    <path d="M15.15 14.96a1.9 1.9 0 1 1-1.9 1.9v-1.9h1.9ZM15.15 14.01a1.9 1.9 0 0 1 0-3.8h4.75a1.9 1.9 0 1 1 0 3.8h-4.75Z" fill="currentColor" opacity=".55" />
  </S>
)

export const Flag = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="M3.5 14V2.5M3.5 3h8.2l-1.9 2.75 1.9 2.75H3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const Eye = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.3" />
  </S>
)

export const Screenful = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5V6M10 2h2.5A1.5 1.5 0 0 1 14 3.5V6M6 14H3.5A1.5 1.5 0 0 1 2 12.5V10M10 14h2.5a1.5 1.5 0 0 0 1.5-1.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </S>
)

export const Paperclip = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="m12.4 7.6-4.6 4.6a3 3 0 0 1-4.2-4.2l5.3-5.3a2 2 0 0 1 2.8 2.8L6.4 10.8a1 1 0 0 1-1.4-1.4l4.2-4.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </S>
)

export const ArrowUp = ({ size = 13 }: P) => (
  <S size={size}>
    <path d="M8 13V3M8 3 3.8 7.2M8 3l4.2 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const FileIcon = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="M4 1.8h5.2L12.8 5.4V13a1.2 1.2 0 0 1-1.2 1.2H4A1.2 1.2 0 0 1 2.8 13V3A1.2 1.2 0 0 1 4 1.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M9 2v3.6h3.6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </S>
)

export const SubIssueArrow = ({ size = 13 }: P) => (
  <S size={size}>
    <path d="M4 3v5a3 3 0 0 0 3 3h5M12 11 9.5 8.5M12 11l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const AgentTasks = ({ size = 15 }: P) => (
  <S size={size}>
    <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="5.9" cy="7" r="0.9" fill="currentColor" />
    <circle cx="10.1" cy="7" r="0.9" fill="currentColor" />
    <path d="M5.6 10h4.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </S>
)

export const Insights = ({ size = 15 }: P) => (
  <S size={size}>
    <rect x="2" y="9" width="2.8" height="5" rx="0.8" fill="currentColor" opacity="0.55" />
    <rect x="6.6" y="5.5" width="2.8" height="8.5" rx="0.8" fill="currentColor" opacity="0.75" />
    <rect x="11.2" y="2" width="2.8" height="12" rx="0.8" fill="currentColor" />
  </S>
)

export const UIRefresh = ({ size = 15 }: P) => (
  <S size={size}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const Sun = ({ size = 14 }: P) => (
  <S size={size}>
    <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </S>
)

export const Moon = ({ size = 14 }: P) => (
  <S size={size}>
    <path d="M13.5 9.7A5.8 5.8 0 0 1 6.3 2.5a5.8 5.8 0 1 0 7.2 7.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </S>
)
