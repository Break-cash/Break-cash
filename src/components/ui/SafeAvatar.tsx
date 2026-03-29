import { useEffect, useMemo, useState } from 'react'

type SafeAvatarProps = {
  src?: string | null
  name?: string | null
  fallbackText?: string | null
  className?: string
  imgClassName?: string
  textClassName?: string
  alt?: string
}

function buildInitials(name?: string | null, fallbackText?: string | null) {
  const raw = String(name || fallbackText || '').trim()
  if (!raw) return '?'
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  return raw.slice(0, 2).toUpperCase()
}

export function SafeAvatar({
  src,
  name,
  fallbackText,
  className = '',
  imgClassName = 'h-full w-full object-cover',
  textClassName = '',
  alt,
}: SafeAvatarProps) {
  const [broken, setBroken] = useState(false)
  const initials = useMemo(() => buildInitials(name, fallbackText), [fallbackText, name])

  useEffect(() => {
    setBroken(false)
  }, [src])

  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.22),rgba(15,23,42,0.96)_55%)] text-white/90 ${className}`}
    >
      {src && !broken ? (
        <img src={src} alt={alt || name || 'avatar'} className={imgClassName} onError={() => setBroken(true)} />
      ) : (
        <span className={`font-semibold ${textClassName}`}>{initials}</span>
      )}
    </div>
  )
}
