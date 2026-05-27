import { useId, type ReactNode } from 'react'
import styles from './Tooltip.module.css'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  className?: string
}

export function Tooltip({ children, content, className }: TooltipProps): JSX.Element {
  const tooltipId = useId()

  return (
    <span className={`${styles.wrapper} ${className ?? ''}`} tabIndex={0} aria-describedby={tooltipId}>
      {children}
      <span id={tooltipId} role="tooltip" className={styles.tooltip}>
        {content}
      </span>
    </span>
  )
}
