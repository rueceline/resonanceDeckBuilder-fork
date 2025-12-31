"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { Database } from "../types"

interface LanguageContextType {
  currentLanguage: string
  isChangingLanguage: boolean
  supportedLanguages: string[]
  getTranslatedString: (key: string) => string
  changeLanguage: (lang: string) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

async function fetchJson(path: string) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export function LanguageProvider({
  children,
  initialLanguage,
  data,
}: {
  children: React.ReactNode
  initialLanguage: string
  data: Database | null
}) {
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage)
  const [isChangingLanguage, setIsChangingLanguage] = useState(false)

  // DB 번역(/public/db/lang_xx.json)과 UI 번역(/public/lang/lang_xx.json) 분리
  const [dbDict, setDbDict] = useState<Record<string, string>>({})
  const [uiDict, setUiDict] = useState<Record<string, string>>({})

  const router = useRouter()

  // supportedLanguages 배열에 'tw' 추가
  const supportedLanguages = ["ko", "en", "jp", "cn", "tw"]

  // 언어팩 로딩: UI(lang) + DB(db) 분리 로드
  useEffect(() => {
    let cancelled = false

    async function loadLangPacks() {
      // 1) DB 번역
      //    - data.languages에 이미 있으면 그걸 우선 사용
      //    - 없으면 public/db에서 로드
      const existingDb = (data && data.languages && data.languages[currentLanguage]) as
        | Record<string, string>
        | undefined

      if (existingDb) {
        if (!cancelled) {
          setDbDict(existingDb || {})
        }
      } else {
        const db = await fetchJson(`/db/lang_${currentLanguage}.json`)
        if (!cancelled) {
          setDbDict((db || {}) as Record<string, string>)
        }
      }

      // 2) UI 번역 (파일명: public/lang/lang_xx.json)
      const ui = await fetchJson(`/lang/ui_${currentLanguage}.json`)
      if (!cancelled) {
        setUiDict((ui || {}) as Record<string, string>)
      }
    }

    loadLangPacks()

    return () => {
      cancelled = true
    }
  }, [currentLanguage, data])

  // 번역 함수: UI 우선 → DB → 키 원문
  const getTranslatedString = useCallback(
    (key: string) => {
      return uiDict[key] || dbDict[key] || key
    },
    [uiDict, dbDict],
  )

  // 언어 변경 함수
  const changeLanguage = useCallback(
    (newLanguage: string) => {
      if (currentLanguage === newLanguage) return

      setIsChangingLanguage(true)

      // URL 변경
      router.push(`/${newLanguage}`)

      // 상태 업데이트
      setCurrentLanguage(newLanguage)

      // 로딩 상태 해제 (약간의 지연 추가)
      setTimeout(() => {
        setIsChangingLanguage(false)
      }, 300)
    },
    [currentLanguage, router],
  )

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        isChangingLanguage,
        supportedLanguages,
        getTranslatedString,
        changeLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

// 커스텀 훅
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
