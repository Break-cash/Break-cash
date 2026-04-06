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
      style={{
        background:
          'radial-gradient(circle at 12% -8%, rgba(56,189,248,0.12), transparent 34%), radial-gradient(circle at 92% 0%, rgba(139,92,246,0.1), transparent 30%)',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  )
}
