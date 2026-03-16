type ToastKind = 'success' | 'error' | 'warning' | 'info'

type ToastAction = {
  label?: string
  to?: string
}

export type ToastPayload = {
  id?: string
  kind?: ToastKind
  title?: string
  message: string
  durationMs?: number
  errorCode?: string
  action?: ToastAction
}

export type ToastRecord = Required<Pick<ToastPayload, 'id' | 'kind' | 'message'>> &
  Omit<ToastPayload, 'id' | 'kind' | 'message'>

type ToastListener = (toast: ToastRecord) => void

const listeners = new Set<ToastListener>()
let nonce = 0
let lastToastSignature = ''
let lastToastAt = 0

function nextToastId() {
  nonce += 1
  return `toast_${Date.now()}_${nonce}`
}

function isDuplicateBurst(toast: ToastRecord) {
  const signature = `${toast.kind}|${toast.errorCode || ''}|${toast.message}`
  const now = Date.now()
  const isDuplicate = signature === lastToastSignature && now - lastToastAt < 2200
  lastToastSignature = signature
  lastToastAt = now
  return isDuplicate
}

function normalizeErrorCode(rawCode: string) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (code === 'INSUFFICIENT_BALANCE') return 'INSUFFICIENT_BALANCE'
  if (code === 'NETWORK_ERROR') return 'NETWORK_ERROR'
  if (code === 'MIN_SUBSCRIPTION' || code === 'INVALID_AMOUNT' || code === 'AMOUNT_INVALID') return 'INVALID_AMOUNT'
  if (code === 'INVALID_INPUT' || code === 'FILE_REQUIRED' || code === 'FILES_REQUIRED') return 'MISSING_DATA'
  return 'TRANSACTION_FAILED'
}

export function emitToast(payload: ToastPayload) {
  const normalizedErrorCode = payload.errorCode ? normalizeErrorCode(payload.errorCode) : undefined
  const toast: ToastRecord = {
    id: payload.id || nextToastId(),
    kind: payload.kind || 'info',
    message: String(payload.message || '').trim(),
    title: payload.title,
    durationMs: payload.durationMs,
    errorCode: normalizedErrorCode,
    action: payload.action,
  }
  if (!toast.message) return
  if (isDuplicateBurst(toast)) return
  listeners.forEach((listener) => listener(toast))
}

export function emitApiErrorToast(errorCode: string, fallbackMessage = '') {
  const code = normalizeErrorCode(errorCode)
  emitToast({
    kind: 'error',
    errorCode: code,
    message: String(fallbackMessage || code),
    durationMs: code === 'INSUFFICIENT_BALANCE' ? 7000 : 4600,
  })
}

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

