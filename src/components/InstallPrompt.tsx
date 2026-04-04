import { useEffect, useMemo, useState } from 'react'
import { Download, Info, X } from 'lucide-react'
import { useNativeAppInstalled } from '../hooks/useNativeAppInstalled'
import { useI18n } from '../i18nCore'
import { AppModalPortal } from './ui/AppModalPortal'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const APK_DOWNLOAD_URL = '/downloads/Break-Cash-Android-Release-v1.apk'

export function InstallPrompt() {
  const { t, direction } = useI18n()
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'other'>('other')
  const nativeAppInstalled = useNativeAppInstalled()

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    const isIos = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)
    setPlatform(isIos ? 'ios' : isAndroid ? 'android' : /windows|macintosh|linux/.test(ua) ? 'desktop' : 'other')

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    setInstalled(standalone)

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    function onAppInstalled() {
      setInstalled(true)
      setPromptEvent(null)
      setGuideOpen(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const steps = useMemo(() => {
    if (platform === 'ios') {
      return [t('install_ios_step_1'), t('install_ios_step_2'), t('install_ios_step_3')]
    }
    if (platform === 'android') {
      return [t('install_android_step_1'), t('install_android_step_2'), t('install_android_step_3')]
    }
    if (platform === 'desktop') {
      return [t('install_desktop_step_1'), t('install_desktop_step_2'), t('install_desktop_step_3')]
    }
    return [t('install_other_step_1'), t('install_other_step_2')]
  }, [platform, t])

  const shouldShowApkDownload =
    !nativeAppInstalled && (platform === 'android' || platform === 'desktop' || platform === 'other')

  if (installed || nativeAppInstalled) return null

  return (
    <>
      <div
        dir={direction}
        className={`fixed bottom-24 z-[70] flex items-center gap-2 rounded-full border border-app-border bg-app-card/95 px-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur ${
          direction === 'rtl' ? 'left-3' : 'right-3'
        }`}
      >
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-white shadow-[0_10px_24px_rgba(59,130,246,0.32)] transition-transform duration-200 hover:scale-[1.03]"
          type="button"
          aria-label={promptEvent ? t('install_prompt_install') : shouldShowApkDownload ? 'Download APK' : t('install_prompt_how')}
          title={promptEvent ? t('install_prompt_install') : shouldShowApkDownload ? 'Download APK' : t('install_prompt_how')}
          onClick={async () => {
            if (promptEvent) {
              await promptEvent.prompt()
              const result = await promptEvent.userChoice
              if (result.outcome === 'accepted') {
                setInstalled(true)
                setGuideOpen(false)
              }
              setPromptEvent(null)
              return
            }
            if (shouldShowApkDownload) {
              window.open(APK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
              return
            }
            setGuideOpen(true)
          }}
        >
          <Download size={16} />
        </button>
        {shouldShowApkDownload ? (
          <a
            className="hidden rounded-full border border-app-border bg-app-elevated px-3 py-2 text-xs font-medium text-white/90 md:inline-flex"
            href={APK_DOWNLOAD_URL}
            download
          >
            APK
          </a>
        ) : null}
        <button
          className="hidden rounded-full border border-app-border bg-app-elevated px-3 py-2 text-xs font-medium text-white/90 md:inline-flex"
          type="button"
          onClick={() => {
            if (promptEvent) {
              return
            }
            setGuideOpen(true)
          }}
        >
          {promptEvent ? t('install_prompt_install') : t('install_prompt_how')}
        </button>
        <button
          className="inline-flex items-center gap-1 rounded-full border border-app-border bg-app-elevated px-3 py-1.5 text-xs text-white/90"
          type="button"
          onClick={() => setGuideOpen(true)}
        >
          <Info size={13} />
          <span>{t('install_prompt_how')}</span>
        </button>
      </div>

      {guideOpen ? (
        <AppModalPortal>
        <div className="liquid-modal-backdrop fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir={direction}>
          <div className="liquid-modal-card w-full max-w-md rounded-2xl border border-app-border bg-app-card p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-white">{t('install_prompt_title')}</h3>
                <p className="mt-1 text-sm text-white/70">{t('install_prompt_message')}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-app-border bg-app-elevated p-1 text-white/75"
                onClick={() => setGuideOpen(false)}
                aria-label={t('install_prompt_close')}
              >
                <X size={14} />
              </button>
            </div>
            <ul className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3 text-sm text-white/85">
              {steps.map((step, idx) => (
                <li key={`${idx}-${step}`} className="leading-relaxed">
                  {idx + 1}. {step}
                </li>
              ))}
            </ul>
            {shouldShowApkDownload ? (
              <a
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(59,130,246,0.28)]"
                href={APK_DOWNLOAD_URL}
                download
              >
                Download APK
              </a>
            ) : null}
            <p className="mt-3 text-xs text-white/60">{t('install_prompt_compatibility')}</p>
          </div>
        </div>
        </AppModalPortal>
      ) : null}
    </>
  )
}
