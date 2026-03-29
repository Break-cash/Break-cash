import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type AppModalPortalProps = {
  children: ReactNode
}

let activeBodyLocks = 0
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''

export function AppModalPortal({ children }: AppModalPortalProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    activeBodyLocks += 1

    if (activeBodyLocks === 1) {
      previousBodyOverflow = document.body.style.overflow
      previousBodyPaddingRight = document.body.style.paddingRight
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
    }

    return () => {
      activeBodyLocks = Math.max(0, activeBodyLocks - 1)
      if (activeBodyLocks === 0) {
        document.body.style.overflow = previousBodyOverflow
        document.body.style.paddingRight = previousBodyPaddingRight
      }
    }
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
