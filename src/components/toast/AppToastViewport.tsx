import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18nCore'
import { subscribeToToasts, type ToastRecord } from '../../toastBus'

function resolveToastMessage(toast: ToastRecord, t: (key: string) => string) {
  if (toast.kind === 'success') return t('toast_success_operation')
  const code = String(toast.errorCode || '').toUpperCase()
  if (code === 'INSUFFICIENT_BALANCE') return t('toast_error_insufficient_balance')
  if (code === 'NETWORK_ERROR') return t('toast_error_network')
  if (code === 'MISSING_DATA') return t('toast_error_missing_data')
  if (code === 'INVALID_AMOUNT') return t('toast_error_invalid_amount')
  if (code === 'TRANSACTION_FAILED') return t('toast_error_transaction_failed')
  if (toast.kind === 'error') return t('toast_error_transaction_failed')
  return toast.message || t('toast_error_transaction_failed')
}

function resolveToastTitle(toast: ToastRecord, t: (key: string) => string) {
  if (toast.title) return toast.title
  if (toast.kind === 'success') return t('toast_title_success')
  if (toast.kind === 'warning') return t('toast_title_warning')
  if (toast.kind === 'info') return t('toast_title_info')
  return t('toast_title_error')
}

function resolveToastStyles(kind: ToastRecord['kind']) {
  if (kind === 'success') {
    return {
      border: 'border-emerald-400/45',
      bg: 'bg-[linear-gradient(180deg,rgba(7,49,33,0.92),rgba(9,35,27,0.96))]',
      dot: 'bg-emerald-400',
    }
  }
  if (kind === 'warning') {
    return {
      border: 'border-amber-400/45',
      bg: 'bg-[linear-gradient(180deg,rgba(63,44,9,0.92),rgba(45,29,6,0.96))]',
      dot: 'bg-amber-400',
    }
  }
  if (kind === 'info') {
    return {
      border: 'border-sky-400/45',
      bg: 'bg-[linear-gradient(180deg,rgba(12,40,68,0.92),rgba(10,30,50,0.96))]',
      dot: 'bg-sky-400',
    }
  }
  return {
    border: 'border-rose-400/45',
    bg: 'bg-[linear-gradient(180deg,rgba(66,17,24,0.92),rgba(44,12,17,0.96))]',
    dot: 'bg-rose-400',
  }
}

export function AppToastViewport() {
  const { t, direction } = useI18n()
  const navigate = useNavigate()
  const [items, setItems] = useState<ToastRecord[]>([])

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setItems((prev) => {
        const next = [...prev, toast]
        return next.slice(-5)
      })
    })
  }, [])

  useEffect(() => {
    if (items.length === 0) return
    const timers = items.map((item) =>
      window.setTimeout(
        () => setItems((prev) => prev.filter((x) => x.id !== item.id)),
        Math.max(2400, Number(item.durationMs || 5000)),
      ),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [items])

  const containerPosition = useMemo(
    () => (direction === 'rtl' ? 'left-3 right-auto' : 'right-3 left-auto'),
    [direction],
  )

  return (
    <div className={`pointer-events-none fixed top-[calc(12px+env(safe-area-inset-top))] z-[160] w-[min(92vw,400px)] ${containerPosition}`}>
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const styles = resolveToastStyles(item.kind)
          const message = resolveToastMessage(item, t)
          const title = resolveToastTitle(item, t)
          const needsDepositAction = String(item.errorCode || '').toUpperCase() === 'INSUFFICIENT_BALANCE'
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`pointer-events-auto mb-2 overflow-hidden rounded-2xl border ${styles.border} ${styles.bg} shadow-[0_18px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl`}
            >
              <div className="flex items-start gap-3 p-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs text-white/85">{message}</p>
                  {needsDepositAction ? (
                    <button
                      type="button"
                      className="mt-2 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
                      onClick={() => navigate('/deposit')}
                    >
                      {t('toast_go_deposit')}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                  aria-label={t('toast_close')}
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

