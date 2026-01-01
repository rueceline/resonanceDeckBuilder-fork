"use client"

import { useEffect, useState } from "react"
import type { Database } from "../types"
import { dummyData } from "../dummy"

// Flag to control data source - 더미 데이터 사용 여부
const USE_DUMMY = false

function toAssetPath(p: unknown): string {
  let s = String(p ?? "").trim()
  if (!s) return ""

  s = s.replace(/\\/g, "/")
  s = s.replace(/\/{2,}/g, "/")
  s = s.replace(/^\/+/, "")

  return "/assets/" + s
}

export function useDataLoader() {
  const [data, setData] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        if (USE_DUMMY) {
          setData(dummyData)
        } else {
          const [
            charactersResponse,
            cardsResponse,
            skillsResponse,
            breakthroughsResponse,
            talentsResponse,
            equipmentsResponse,
            homeSkillsResponse,
            charSkillMapResponse,
            itemSkillMapResponse,
          ] = await Promise.all([
            fetch("/api/db/char_db.json"),
            fetch("/api/db/card_db.json"),
            fetch("/api/db/skill_db.json"),
            fetch("/api/db/break_db.json"),
            fetch("/api/db/talent_db.json"),
            fetch("/api/db/equip_db.json"),
            fetch("/api/db/home_skill_db.json"),
            fetch("/api/db/char_skill_map.json"),
            fetch("/api/db/item_skill_map.json"),
          ])

          const [
            characters,
            cards,
            skills,
            breakthroughs,
            talents,
            equipments,
            homeSkills,
            charSkillMap,
            itemSkillMap,
          ] = await Promise.all([
            charactersResponse.json(),
            cardsResponse.json(),
            skillsResponse.json(),
            breakthroughsResponse.json(),
            talentsResponse.json(),
            equipmentsResponse.json(),
            homeSkillsResponse.json(),
            charSkillMapResponse.json(),
            itemSkillMapResponse.json(),
          ])

          // 현재 언어 코드 추출
          const currentLang = getCurrentLanguage()

          function getCurrentLanguage(): string {
            if (typeof window !== "undefined") {
              const pathParts = window.location.pathname.split("/")
              if (pathParts.length > 1) {
                const langFromPath = pathParts[1]
                if (["ko", "en", "jp", "cn", "tw"].includes(langFromPath)) {
                  return langFromPath
                }
              }

              const browserLang = navigator.language.split("-")[0]
              if (["ko", "en", "jp", "cn", "tw"].includes(browserLang)) {
                return browserLang
              }
            }

            return "en"
          }

          const languageResponse = await fetch(`/api/db/lang_${currentLang}.json`)
          const languageData = await languageResponse.json()

          const languages: Record<string, any> = {}
          languages[currentLang] = languageData

          // Characters: img_card 파생 (DB roleListResUrl 기반)
          Object.keys(characters).forEach((charId) => {
            const char = characters[charId]
            char.img_card = toAssetPath(char.roleListResUrl)
          })

          // 기존 backward compatibility 블럭(원본 유지)
          Object.keys(characters).forEach((charId) => {
            const char = characters[charId]

            const qualityToRarity: Record<string, string> = {
              oneStar: "N-",
              twoStar: "N",
              threeStar: "R",
              fourStar: "SR",
              FiveStar: "SSR",
              SixStar: "UR",
            }

            char.rarity = qualityToRarity[char.quality] || "N-"
            char.desc = char.identity || `char_desc_${charId}`
          })

          // Equipments: url 파생 (DB tipsPath 기반)
          Object.keys(equipments).forEach((equipId) => {
  const equipment = equipments[equipId]
  equipment.url = toAssetPath(equipment.tipsPath)

  // 추가: 원본 DB에 type이 없으므로 equipTagId로 파생 (use-data-loader_old.ts 로직 이식)
  if (!equipment.type) {
    const tagId = Number(equipment.equipTagId ?? 0)

    if (tagId >= 12600155 && tagId <= 12600160) {
      equipment.type = "weapon"
    } else if (tagId === 12600161) {
      equipment.type = "armor"
    } else if (tagId === 12600162) {
      equipment.type = "accessory"
    } else {
      equipment.type = "weapon"
    }
  }

  if (equipment.skillList && Array.isArray(equipment.skillList)) {
  } else if (equipment.skillList) {
    const skillListObj = equipment.skillList as unknown as Record<string, any>
    const skillListArray = Object.keys(skillListObj).map((key) => ({
      skillId: Number(skillListObj[key].skillId || key),
    }))
    equipment.skillList = skillListArray
  }
})

          // Skills: img_url 파생 (DB iconPath 기반)
          Object.keys(skills).forEach((skillId) => {
            const skill = skills[skillId]
            skill.img_url = toAssetPath(skill.iconPath)
          })

          // Cards: img_url 파생 (DB iconPath 기반, 없으면 빈 값)
          Object.keys(cards).forEach((cardId) => {
            const card = cards[cardId]
            card.img_url = toAssetPath(card.iconPath)
          })

          // Talents / Breakthroughs: img_url 파생 (DB path 기반)
          Object.keys(talents).forEach((tid) => {
            const t = talents[tid]
            t.img_url = toAssetPath(t.path)
          })

          Object.keys(breakthroughs).forEach((bid) => {
            const b = breakthroughs[bid]
            b.img_url = toAssetPath(b.path)
          })

          // equipmentTypes는 원본 코드가 사실상 빈 객체였으므로 그대로 유지
          const equipmentTypes = {}

          setData({
            characters,
            cards,
            skills,
            breakthroughs,
            talents,
            languages,
            equipments,
            equipmentTypes,
            homeSkills,
            charSkillMap,
            itemSkillMap,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return { data, loading, error }
}
