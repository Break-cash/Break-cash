import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, languageDirection, translations, type I18nContextValue, type Language } from './i18nCore'

function detectLanguage(): Language {
  const raw = (navigator.language || '').toLowerCase()
  if (raw.startsWith('ar')) return 'ar'
  if (raw.startsWith('tr')) return 'tr'
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('breakcash_language')
    return saved === 'en' || saved === 'tr' || saved === 'ar' ? saved : detectLanguage()
  })

  const direction = languageDirection[language]

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
    localStorage.setItem('breakcash_language', language)
  }, [language, direction])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      direction,
      setLanguage: setLanguageState,
      t: (key: string) => translations[language][key] || key,
    }),
    [language, direction],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
