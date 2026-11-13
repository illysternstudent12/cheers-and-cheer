import { useId, useState, type ReactNode } from 'react'
import { IconChevronDown } from './Icons'

/** Expandable panel with an animated height (grid-rows 0fr → 1fr). */
export function Disclosure({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: ReactNode
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={`disc${open ? ' is-open' : ''}`}>
      <button className="disc-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}>
        {icon && <span className="disc-icon">{icon}</span>}
        <span className="disc-title">{title}</span>
        <IconChevronDown size={18} className="disc-chev" />
      </button>
      <div className={`collapse${open ? ' open' : ''}`} id={id} inert={!open}>
        <div>
          <div className="disc-body">{children}</div>
        </div>
      </div>
    </div>
  )
}
