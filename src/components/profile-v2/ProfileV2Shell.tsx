import type { ReactNode, TouchEvent } from 'react'

type ProfileV2ShellProps = {
  children: ReactNode
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void
  onTouchMove: (event: TouchEvent<HTMLDivElement>) => void
  onTouchEnd: () => void
}

export function ProfileV2Shell({
  children,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: ProfileV2ShellProps) {
  return (
    <div
      className="space-y-4 pb-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  )
}

