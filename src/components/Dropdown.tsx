import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface MenuOption {
  key: string
  label: string
  icon?: ReactNode
  checked?: boolean
}

export function Dropdown({
  trigger,
  options,
  onSelect,
  header,
  closeOnSelect = true,
}: {
  trigger: (open: boolean) => ReactNode
  options: MenuOption[]
  onSelect: (key: string) => void
  header?: string
  closeOnSelect?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Flip upward when the menu would overflow the viewport bottom.
  useEffect(() => {
    if (!open) {
      setFlip(false)
      return
    }
    const r = menuRef.current?.getBoundingClientRect()
    if (r && r.bottom > window.innerHeight - 8) setFlip(true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className="dropdown" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div className={`menu${flip ? ' flip' : ''}`} ref={menuRef}>
          {header && <div className="menu-header">{header}</div>}
          {options.map((opt) => (
            <button
              key={opt.key}
              className="menu-item"
              onClick={() => {
                onSelect(opt.key)
                if (closeOnSelect) setOpen(false)
              }}
            >
              {opt.icon && <span className="menu-item-icon">{opt.icon}</span>}
              <span className="menu-item-label">{opt.label}</span>
              {opt.checked && <span className="menu-item-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
