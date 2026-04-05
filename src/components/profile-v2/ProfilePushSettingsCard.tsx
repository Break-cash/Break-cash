type ProfilePushSettingsCardProps = {
  pushSupported: boolean
  pushPermission: 'default' | 'denied' | 'granted'
  pushSubscribed: boolean
  pushBusy: boolean
  onTogglePush: () => void
  onSendPushPreview: () => void
}

export function ProfilePushSettingsCard({
  pushSupported,
  pushPermission,
  pushSubscribed,
  pushBusy,
  onTogglePush,
  onSendPushPreview,
}: ProfilePushSettingsCardProps) {
  return (
    <section className="glass-panel elite-enter rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
      <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">الإشعارات الخارجية</div>
      <div className="space-y-3">
        <div className="text-sm text-[var(--text-secondary)]">
          {pushPermission === 'denied'
            ? 'الإشعارات محظورة من المتصفح أو النظام.'
            : pushSubscribed
              ? 'الإشعارات الخارجية مفعّلة لهذا الجهاز.'
              : 'فعّل الإشعارات ليصلك تنبيه حتى عند الخروج من التطبيق.'}
        </div>
        <div className="flex flex-wrap gap-2">
          {pushSupported ? (
            <>
              <button
                type="button"
                onClick={onTogglePush}
                className="wallet-action-btn owner-set-btn"
                disabled={pushBusy}
              >
                {pushBusy ? '...' : pushSubscribed ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات'}
              </button>
              <button
                type="button"
                onClick={onSendPushPreview}
                className="wallet-action-btn wallet-action-deposit"
                disabled={pushBusy || (!pushSubscribed && pushPermission === 'denied')}
              >
                {pushBusy ? '...' : 'إرسال إشعار تجريبي'}
              </button>
            </>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">هذا المتصفح أو الجهاز لا يدعم Web Push.</div>
          )}
        </div>
      </div>
    </section>
  )
}

