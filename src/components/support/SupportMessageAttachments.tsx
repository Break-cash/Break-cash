import { ImagePlus, Paperclip } from 'lucide-react'
import type { SupportMessageAttachment } from '../../api'

function fileSizeLabel(bytes?: number) {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

export function SupportMessageAttachments({ attachments }: { attachments: SupportMessageAttachment[] }) {
  if (!attachments.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((file) => {
        const isImage = String(file.mime_type || '').startsWith('image/')
        return (
          <a
            key={file.id}
            href={file.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 transition hover:bg-white/10"
          >
            {isImage ? <ImagePlus size={14} /> : <Paperclip size={14} />}
            <span>{file.original_name || 'attachment'}</span>
            <span className="text-white/45">{fileSizeLabel(file.byte_size)}</span>
          </a>
        )
      })}
    </div>
  )
}
