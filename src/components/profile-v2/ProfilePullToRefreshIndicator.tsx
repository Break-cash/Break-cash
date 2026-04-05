type ProfilePullToRefreshIndicatorProps = {
  pullDistance: number
  isPullRefreshing: boolean
  loadingText: string
  pullText: string
}

export function ProfilePullToRefreshIndicator({
  pullDistance,
  isPullRefreshing,
  loadingText,
  pullText,
}: ProfilePullToRefreshIndicatorProps) {
  const isVisible = pullDistance > 0 || isPullRefreshing

  return (
    <div
      className="pointer-events-none overflow-hidden transition-[max-height,opacity] duration-200"
      style={{ maxHeight: isVisible ? 40 : 0, opacity: isVisible ? 1 : 0 }}
    >
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1e2430]/85 px-3 py-1 text-[11px] text-white/85">
        <span>{isPullRefreshing ? loadingText : pullText}</span>
      </div>
    </div>
  )
}

