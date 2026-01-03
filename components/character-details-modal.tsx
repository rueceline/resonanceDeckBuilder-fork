"use client";
import type { Character, Card } from "../types";
import type React from "react";
import { useState, useEffect } from "react";
import { TabModal } from "./ui/modal/TabModal";
import { formatColorText } from "../utils/format-text";

interface CharacterDetailsModalProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;
  character: Character;
  getTranslatedString: (key: string) => string;
  getCardInfo: (cardId: string) => { card: Card } | null;
  getSkill?: (skillId: number) => any;
  data?: any;
  initialTab?: "info" | "skills" | "talents" | "breakthroughs";
  selectedAwakeningStage?: number | null;
  onAwakeningSelect?: (stage: number | null) => void;
}

export function CharacterDetailsModal({
  isOpen,
  onClose,
  character,
  getTranslatedString,
  getCardInfo,
  getSkill,
  data,
  initialTab = "info",
  selectedAwakeningStage = null,
  onAwakeningSelect,
}: CharacterDetailsModalProps) {
   // character-details-modal.tsx 내부, character/data 접근 가능한 위치에 추가
// 예: 컴포넌트 함수 본문 최상단

function debugAwakeningMap() {
  const list = Array.isArray(character?.breakthroughList) ? character.breakthroughList : [];

  const rows = list.map((b: any, idx: number) => {
    const id =
      typeof b === "number" ? b :
      typeof b === "object" && b ? (b.breakthroughId ?? b.id ?? 0) :
      0;

    const keyStr = String(id);

    const rec = (data as any)?.breakthroughs?.[keyStr] ?? (data as any)?.breakthroughs?.[id] ?? null;

    // name/desc는 ConfigLanguage에서 매칭되는 "키 문자열"일 가능성이 높음
    // (예: "breakthrough_name_123..." 같은 키)
    const nameKey = rec?.name ?? "";
    const descKey = rec?.desc ?? "";
    const img = rec?.img_url ?? "";

    // 번역 적용(프로젝트에 이미 있는 함수 사용)
    // getTranslatedString이 없으면 nameKey/descKey 그대로 출력됨
    const nameKO =
      typeof (globalThis as any).getTranslatedString === "function"
        ? (globalThis as any).getTranslatedString(nameKey)
        : (typeof (getTranslatedString as any) === "function" ? (getTranslatedString as any)(nameKey) : nameKey);

    const descKO =
      typeof (globalThis as any).getTranslatedString === "function"
        ? (globalThis as any).getTranslatedString(descKey)
        : (typeof (getTranslatedString as any) === "function" ? (getTranslatedString as any)(descKey) : descKey);

    return {
      idx,
      raw: b,
      breakthroughId: id,
      dbFound: !!rec,
      dbKeys: rec ? Object.keys(rec) : [],
      nameKey,
      nameKO,
      descKey,
      descKO,
      img_url: img,
    };
  });  

  // 추가: “못찾는 케이스”만 따로 모아서 출력
  const missing = rows.filter((r) => !r.dbFound || !r.breakthroughId);
  if (missing.length) {
    console.warn("[debug] breakthrough missing/invalid", missing);
  }
}

// 호출
debugAwakeningMap();


  // 홈 스킬 데이터를 저장할 상태 추가
  const [homeSkills, setHomeSkills] = useState<any[]>([]);

  // 컴포넌트 마운트 시 홈 스킬 데이터 로드
  useEffect(() => {
    if (!character || !data) return;
    if (!character.homeSkillList || character.homeSkillList.length === 0) {
      setHomeSkills([]);
      return;
    }

    const HOME_PARAM_SCALE = 1_000_000;

    const homeSkillById = new Map<number, any>();
    for (const h of Object.values(data.homeSkills || {})) {
      if (h && h.id != null) {
        homeSkillById.set(Number(h.id), h);
      }
    }

    const rawList = character.homeSkillList;

    // 1) index 기준 base param 적재
    const accParamByIndex = new Map<number, number>();

    rawList.forEach((hs: any, idx: number) => {
      const hid = Number(hs?.id);
      const hrec = homeSkillById.get(hid);
      if (!hrec) return;

      const baseParam = Number(hrec.param);
      if (!Number.isFinite(baseParam)) return;

      accParamByIndex.set(idx, Math.trunc(baseParam * HOME_PARAM_SCALE));
    });

    // 2) nextIndex 체인 누적 (character_detail.js 규칙)
    rawList.forEach((hs: any, idx: number) => {
      const nextIdx1 = Number(hs?.nextIndex);
      if (!Number.isFinite(nextIdx1) || nextIdx1 <= 0) return;

      const nextIdx0 = nextIdx1 - 1;

      if (!accParamByIndex.has(idx)) return;
      if (!accParamByIndex.has(nextIdx0)) return;

      accParamByIndex.set(
        nextIdx0,
        accParamByIndex.get(nextIdx0)! + accParamByIndex.get(idx)!
      );
    });

    // 3) desc + %s 치환 완료된 homeSkill 생성
    // 3) desc + %s 치환 완료된 homeSkill 생성
    // 3) desc + nextIndex 누적값 적용
    const computedHomeSkills = rawList
      .map((hs: any, idx: number) => {
        const hid = Number(hs?.id);
        const hrec = homeSkillById.get(hid);
        if (!hrec) return null;

        const descTpl = String(
          getTranslatedString(hrec.desc) || hrec.desc || ""
        );

        const accScaled = accParamByIndex.get(idx);
        let paramText = "";

        if (typeof accScaled === "number") {
          const accParam = accScaled / HOME_PARAM_SCALE;

          // ⭐ isPCT 미존재 → 소수 여부로 % 판별
          if (!Number.isInteger(accParam)) {
            const pct = accParam * 100;
            const pctTrunc = Math.trunc(pct * 10) / 10;
            paramText = pctTrunc.toFixed(1);
          } else {
            const vTrunc = Math.trunc(accParam * 1000) / 1000;
            paramText = String(vTrunc);
          }
        }

        // %s 에 실제 누적 계산값 적용
        let desc = descTpl.replace(/%s/g, paramText);

        // %% 는 % 출력용 escape
        desc = desc.replace(/%%/g, "%");

        return {
          id: hid,
          resonanceLv: Number(hs?.resonanceLv),
          name: getTranslatedString(hrec.name) || hrec.name,
          desc,
        };
      })
      .filter(Boolean);

    setHomeSkills(computedHomeSkills);
  }, [character, data]);

  // Function to get rarity badge color
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "UR":
        return "bg-gradient-to-r from-orange-500 to-amber-500";
      case "SSR":
        return "bg-gradient-to-r from-yellow-500 to-amber-500";
      case "SR":
        return "bg-gradient-to-r from-purple-500 to-indigo-500";
      case "R":
        return "bg-gradient-to-r from-blue-500 to-cyan-500";
      default:
        return "bg-gray-500";
    }
  };

  // Process skill description to replace #r with actual values
  const processSkillDescription = (skill: any, description: string) => {
    if (!skill || !description) return description;

    // 번역된 설명 가져오기, \\n -> \n 개행
    const translatedDesc = getTranslatedString(description).replace(
      /\\n/g,
      "\n"
    );

    // Check if desParamList exists and has items
    if (skill.desParamList && skill.desParamList.length > 0) {
      // 모든 #r 태그를 찾아서 배열로 저장
      const rTags = translatedDesc.match(/#r/g) || [];

      // #r 태그가 없으면 원본 반환
      if (rTags.length === 0) return translatedDesc;

      let processedDesc = translatedDesc;
      let rTagIndex = 0;

      // desParamList의 각 항목을 순회하면서 #r 태그를 순서대로 대체
      for (
        let i = 0;
        i < skill.desParamList.length && rTagIndex < rTags.length;
        i++
      ) {
        const param = skill.desParamList[i];
        const paramValue = param.param;

        // Check if skillParamList exists
        if (skill.skillParamList && skill.skillParamList[0]) {
          // Find the skillRate key based on param value
          const rateKey = `skillRate${paramValue}_SN`;
          if (skill.skillParamList[0][rateKey] !== undefined) {
            // Calculate the rate value (divide by 10000)
            let rateValue = Math.floor(
              skill.skillParamList[0][rateKey] / 10000
            );

            // Add % if isPercent is true
            if (param.isPercent) {
              rateValue = `${skill.skillParamList[0][rateKey] / 100}%`;
            }

            // Replace only the first occurrence of #r
            processedDesc = processedDesc.replace(/#r/, rateValue.toString());
            rTagIndex++;
          }
        }
      }

      return processedDesc;
    }

    return translatedDesc;
  };

  // Format text with color tags and other HTML tags

  // 각성 항목 선택 핸들러
  const handleAwakeningSelect = (stage: number) => {
    if (onAwakeningSelect) {
      // 이미 선택된 항목을 다시 클릭하면 선택 취소
      if (selectedAwakeningStage === stage) {
        onAwakeningSelect(null);
      } else {
        onAwakeningSelect(stage);
      }
    }
  };

  // 이미지 URL 가져오기 함수
  const getImageUrl = (type: "talent" | "break", id: number) => {
    if (!data) return null;

    if (type === "talent") {
      const t = data.talents[String(id)];
      return t && t.img_url ? t.img_url : null;
    }

    const b = data.breakthroughs[String(id)];
    return b && b.img_url ? b.img_url : null;
  };

  const modalProps = {
    isOpen: isOpen,
    onClose: (e) => onClose(e),
    tabs: [
      {
        id: "info",
        label: getTranslatedString("character.info") || "Profile",
        content: (
          <div className="flex flex-col md:flex-row gap-4 p-4">
            {/* Character Image and Description */}
            <div className="w-full md:w-1/3">
              <div className="aspect-[3/4] max-w-[200px] mx-auto md:max-w-none bg-black rounded-lg overflow-hidden neon-border">
                {character.img_card && (
                  <img
                    src={character.img_card || "/placeholder.svg"}
                    alt={getTranslatedString(character.name)}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="mt-2 text-center">
                <div className="text-lg font-bold flex items-center justify-center">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full text-white mr-2 ${getRarityColor(
                      character.rarity
                    )}`}
                  >
                    {character.rarity}
                  </span>
                  <span className="neon-text">
                    {getTranslatedString(character.name)}
                  </span>
                </div>
              </div>

              {/* Character Description moved below portrait - 포맷팅 적용 */}
              <div className="mt-4 character-detail-section">
                <p className="text-gray-300">
                  {formatColorText(getTranslatedString(character.getCharacter))}
                </p>
              </div>
            </div>

            {/* <div className="flex flex-col md:flex-row gap-4 p-4"> */}

            <div className="w-full md:w-2/3">
              <div className="character-detail-section space-y-2">
                <div>
                  <strong>{getTranslatedString("character.birthday")} : </strong>{" "}
                  {getTranslatedString(character.birthday)}
                </div>

                <div>
                  <strong>{getTranslatedString("character.gender")} : </strong>
                  {getTranslatedString(character.gender)}
                </div>

                <div>
                  <strong>{getTranslatedString("character.height")} : </strong>
                  {character.height}
                </div>

                <div>
                  <strong>
                    {getTranslatedString("character.birthplace")}:
                  </strong>
                  {getTranslatedString(character.birthplace)}
                </div>
                
                <div>
                  <strong>{getTranslatedString("character.identity")} : </strong>
                  {getTranslatedString(character.identity)}
                </div>

                <div>
                  <strong>{getTranslatedString("character.ability")} : </strong>
                  {getTranslatedString(character.ability)}
                </div>                

                <div className="mt-4">
                  <strong>{getTranslatedString("character.Resume")}</strong>
                  {Array.isArray(character.ResumeList) &&
                    character.ResumeList.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {character.ResumeList.map((r: any, idx: number) => (
                          <div
                            key={`resume-${idx}`}
                            className="text-sm text-gray-300"
                          >
                            {formatColorText(getTranslatedString(r.des))}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "skills",
        label: getTranslatedString("character.Skills") || "Character & Skills",
        content: (
          <div className="space-y-3 p-4">
            {/* Character Skills */}
            <div className="space-y-3">
              {/* Skill 1 */}
              {renderSkill(0, "skill.normal_1", "Skill 1")}

              {/* Skill 2 */}
              {renderSkill(1, "skill.normal_2", "Skill 2")}

              {/* Ultimate Skill */}
              {renderSkill(2, "skill.ultimate", "Ultimate")}
            </div>
          </div>
        ),
      },
      {
        id: "talents",
        label: getTranslatedString("character.talents") || "Talents",
        content: (
          <div className="space-y-3 p-4">
            {character.talentList && character.talentList.length > 0 ? (
              character.talentList.map((talent, index) => {
                // 공명 이미지 URL 가져오기
                const talentImageUrl = getImageUrl("talent", talent.talentId);

                // 해당 공명 단계에 맞는 홈 스킬 찾기
                const relatedHomeSkills = homeSkills.filter(
                  (skill) => skill.resonanceLv === index + 1
                );

                // ⭐ talent_db 레코드 (skillList 포함)
                const talentRec =
                  (data?.talents &&
                    (data.talents[String(talent.talentId)] ||
                      data.talents[talent.talentId])) ||
                  null;

                const talentBaseSkillId =
                  talentRec && talentRec.skillIntensify
                    ? Number(talentRec.skillIntensify)
                    : 0;

                return (
                  <div
                    key={`talent-${index}`}
                    className="p-3 bg-black bg-opacity-50 rounded-lg"
                  >
                    <div className="flex">
                      {/* 공명 이미지 또는 번호 표시 */}
                      <div className="w-12 h-12 flex-shrink-0 mr-3 rounded-md overflow-hidden flex items-center justify-center">
                        {talentImageUrl ? (
                          <img
                            src={talentImageUrl || "/placeholder.svg"}
                            alt={`Talent ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex-grow">
                        <div className="flex items-center">
                          <div className="font-medium neon-text">
                            {talentRec
                              ? getTranslatedString(talentRec.name)
                              : `Talent ${talent.talentId}`}
                          </div>
                          {/* 공명 단계 표시 */}
                          <div className="ml-2 text-xs px-2 py-0.5 bg-gray-600 rounded-full text-white">
                            {"Lv."} {index + 1}
                          </div>
                        </div>

                        <div className="text-sm text-gray-400 mt-1">
                          {formatColorText(
                            talentRec
                              ? getTranslatedString(talentRec.desc)
                              : "No description available"
                          )}
                        </div>

                        {/* 관련 홈 스킬 표시 */}
                        {relatedHomeSkills.length > 0 && (
                          <div className="mt-2 border-t border-gray-700 pt-2">
                            {relatedHomeSkills.map((skill, skillIndex) => (
                              <div
                                key={`home-skill-${skillIndex}`}
                                className="text-xs text-gray-300 ml-2 mb-1"
                              >
                                <span className="font-medium text-white">
                                  {getTranslatedString(skill.name) ||
                                    skill.name}
                                  :
                                </span>{" "}
                                {formatColorText(skill.desc)}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ⭐ 특성 스킬(= talent_db.skillList) + 파생 스킬 표시 */}
                        {talentBaseSkillId > 0 && (
                          <div className="mt-3 border-t border-gray-700 pt-3">
                            {renderTalentSkill({
                              skillId: talentBaseSkillId,
                              rowKey: `talent-derived-skill-${talent.talentId}`,
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-400 text-center p-4">
                {getTranslatedString("no_talents") || "No talents available"}
              </div>
            )}
          </div>
        ),
      },

      {
        id: "breakthroughs",
        label:
          getTranslatedString("character.breakthroughs") || "Breakthroughs",
        content: (
          <div className="space-y-3 p-4">
            {character.breakthroughList &&
            character.breakthroughList.length > 0 ? (
              // 각성 항목 선택 가능하도록 수정
              character.breakthroughList.slice(1).map((breakthrough, index) => {
                // 각성 이미지 URL 가져오기
                const breakImageUrl = getImageUrl(
                  "break",
                  breakthrough.breakthroughId
                );

                return (
                  <div
                    key={`breakthrough-${index}`}
                    className={`p-3 bg-black bg-opacity-50 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedAwakeningStage !== null &&
                      index + 1 <= selectedAwakeningStage
                        ? "border-2 border-blue-500 shadow-lg shadow-blue-500/50"
                        : "hover:bg-black hover:bg-opacity-70"
                    }`}
                    onClick={() => handleAwakeningSelect(index + 1)}
                  >
                    <div className="flex">
                      {/* 각성 이미지 또는 번호 표시 */}
                      <div
                        className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center mr-3 overflow-hidden ${
                          selectedAwakeningStage !== null &&
                          index + 1 <= selectedAwakeningStage
                            ? "bg-purple-600"
                            : ""
                        }`}
                      >
                        {breakImageUrl ? (
                          <img
                            src={breakImageUrl || "/placeholder.svg"}
                            alt={`Breakthrough ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex-grow">
                        <div className="flex items-center">
                          <div className="font-medium neon-text">
                            {data?.breakthroughs &&
                            data.breakthroughs[breakthrough.breakthroughId]
                              ? getTranslatedString(
                                  data.breakthroughs[
                                    breakthrough.breakthroughId
                                  ].name
                                )
                              : `Breakthrough ${breakthrough.breakthroughId}`}
                          </div>
                          {/* 각성 단계 표시 */}
                          <div className="ml-2 text-xs px-2 py-0.5 bg-gray-600 rounded-full text-white">
                            {"Lv."} {index + 1}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {formatColorText(
                            data?.breakthroughs &&
                              data.breakthroughs[breakthrough.breakthroughId]
                              ? getTranslatedString(
                                  data.breakthroughs[
                                    breakthrough.breakthroughId
                                  ].desc
                                )
                              : "No description available"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-400 text-center p-4">
                {getTranslatedString("no_breakthroughs") ||
                  "No breakthroughs available"}
              </div>
            )}
          </div>
        ),
      },
    ],
  };

  return (
    <TabModal
      {...modalProps}
      initialTabId={initialTab}
      footer={
        <div className="flex justify-end">
          <button
            onClick={() => onClose()}
            className="neon-button px-4 py-2 rounded-lg text-sm"
          >
            Close
          </button>
        </div>
      }
      maxWidth="max-w-5xl"
      closeOnOutsideClick={true} // 외부 클릭으로 닫히지 않도록 설정
    />
  );

  // Helper function to render a skill
  function renderSkill(index: number, labelKey: string, defaultLabel: string) {
    function toInt(v: any) {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    if (!character.skillList || character.skillList.length <= index) {
      return (
        <div className="p-3 rounded-lg opacity-50">
          <div className="flex items-center">
            <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full mr-2">
              {getTranslatedString(labelKey) || defaultLabel}
            </span>
            <span className="font-medium">
              {getTranslatedString("skill.not_available") || "Not Available"}
            </span>
          </div>
        </div>
      );
    }

    const skillItem = character.skillList[index];
    const skillId = toInt(skillItem?.skillId);
    const skillQuantity = toInt(skillItem?.num);

    const skill = getSkill ? getSkill(skillId) : null;
    if (!skill) {
      return (
        <div className="p-3 rounded-lg opacity-50">
          <span className="font-medium">
            {getTranslatedString("skill.not_found") || `Skill ID: ${skillId}`}
          </span>
        </div>
      );
    }

    // 기본 스킬 이미지 URL
    let skillImageUrl: string | null = null;
    const rawIconPath = String(skill.iconPath ?? "").trim();
    if (rawIconPath) {
      if (
        rawIconPath.startsWith("http://") ||
        rawIconPath.startsWith("https://") ||
        rawIconPath.startsWith("/")
      ) {
        skillImageUrl = rawIconPath;
      } else {
        skillImageUrl = `/assets/${rawIconPath.replace(/^\/+/, "")}`;
      }
    }

    // 기본 스킬 cost
    let skillCost = 0;
    if (skill.cardID) {
      const cardData = data?.cards[skill.cardID];
      if (cardData && cardData.cost_SN !== undefined) {
        skillCost = Math.floor(cardData.cost_SN / 10000);
      }
    }

    const processedDescription = processSkillDescription(
      skill,
      getTranslatedString(skill.description)
    );

    // 파생 스킬(1-depth) 수집: ExSkillList = [{ ExSkillName, isNeturality }]
    const exList = Array.isArray(skill.ExSkillList) ? skill.ExSkillList : [];
    const derivedSkills = exList
      .map((ex: any) => ({
        skillId: toInt(ex?.ExSkillName),
        isNeturality: ex?.isNeturality === true,
      }))
      .filter((x) => x.skillId > 0);

    return (
      <div className="space-y-2">
        {/* 기본 스킬 */}
        <div className="p-3 rounded-lg">
          <div className="flex">
            <div className="w-12 h-12 bg-black rounded-md overflow-hidden mr-3 flex-shrink-0">
              {skillImageUrl ? (
                <img
                  src={skillImageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  No Image
                </div>
              )}
            </div>

            <div className="flex-grow">
              <div className="flex items-center">
                <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full mr-2">
                  {getTranslatedString(labelKey) || defaultLabel}
                </span>
                <span className="font-medium neon-text">
                  {getTranslatedString(skill.name)}
                </span>
                <span className="ml-2 text-sm text-gray-300">
                  COST : {skillCost} / {getTranslatedString("amount")} :{" "}
                  {skillQuantity}
                </span>
              </div>

              {processedDescription && (
                <div className="text-sm text-gray-400 mt-1">
                  {formatColorText(processedDescription)}
                </div>
              )}

              {index === 2 && skill.leaderCardConditionDesc && (
                <div className="text-sm mt-2" style={{ color: "#ca0a3aff" }}>
                  <strong>
                    {getTranslatedString("leader_skill_condition")}:{" "}
                  </strong>
                  {formatColorText(
                    getTranslatedString(skill.leaderCardConditionDesc)
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 파생 스킬 */}
        {derivedSkills.length > 0 && (
          <div className="space-y-2 ml-8">
            {derivedSkills.map(({ skillId: exId, isNeturality }) => {
              const exSkill = getSkill ? getSkill(exId) : null;
              if (!exSkill) return null;

              // 파생 스킬 이미지 URL
              let exImageUrl: string | null = null;
              const exIcon = String(exSkill.iconPath ?? "").trim();
              if (exIcon) {
                if (
                  exIcon.startsWith("http://") ||
                  exIcon.startsWith("https://") ||
                  exIcon.startsWith("/")
                ) {
                  exImageUrl = exIcon;
                } else {
                  exImageUrl = `/assets/${exIcon.replace(/^\/+/, "")}`;
                }
              }

              // 파생 스킬 cost
              let exCost = 0;
              if (exSkill.cardID) {
                const cd = data?.cards[exSkill.cardID];
                if (cd && cd.cost_SN !== undefined) {
                  exCost = Math.floor(cd.cost_SN / 10000);
                }
              }

              const exDesc = processSkillDescription(
                exSkill,
                getTranslatedString(exSkill.description)
              );              

              return (
                <div
                  key={`ex-skill-${skillId}-${exId}`}
                  className="border-l border-gray-700 pl-4"
                >
                  <div className="p-3 rounded-lg">
                    <div className="flex">
                      <div className="w-12 h-12 bg-black rounded-md overflow-hidden mr-3 flex-shrink-0">
                        {exImageUrl ? (
                          <img
                            src={exImageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </div>

                      <div className="flex-grow">
                        <div className="flex items-center">                          
                          <span className="font-medium neon-text">
                            {getTranslatedString(exSkill.name)}
                          </span>
                          <span className="ml-2 text-sm text-gray-300">
                            COST : {exCost}
                          </span>
                        </div>

                        {exDesc && (
                          <div className="text-sm text-gray-400 mt-1">
                            {formatColorText(exDesc)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderTalentSkill(params: { skillId: any; rowKey: string }) {
    function toInt(v: any) {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    const skillId = toInt(params.skillId);
    const skill = getSkill ? getSkill(skillId) : null;

    if (!skill) {
      return (
        <div key={params.rowKey} className="p-3 rounded-lg opacity-50">
          <span className="font-medium">
            {getTranslatedString("skill.not_found") || `Skill ID: ${skillId}`}
          </span>
        </div>
      );
    }

    // 이미지
    let imageUrl: string | null = null;
    const icon = String(skill.iconPath ?? "").trim();
    if (icon) {
      if (
        icon.startsWith("http://") ||
        icon.startsWith("https://") ||
        icon.startsWith("/")
      ) {
        imageUrl = icon;
      } else {
        imageUrl = `/assets/${icon.replace(/^\/+/, "")}`;
      }
    }

    // cost
    let cost = 0;
    if (skill.cardID) {
      const cd = data?.cards?.[skill.cardID];
      if (cd && cd.cost_SN !== undefined) {
        cost = Math.floor(cd.cost_SN / 10000);
      }
    }

    let desc = processSkillDescription(
      skill,
      getTranslatedString(skill.description)
    );

    if (desc && desc.includes("%s")) {
      desc = desc.replace(/%s/g, skill.isPercent === true ? "n%" : "n");
    }

    return (
      <div
        key={params.rowKey}
        className="p-3 rounded-lg border-l border-red-700 ml-6"
      >
        <div className="flex">
          <div className="w-12 h-12 bg-black rounded-md overflow-hidden mr-3 flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                No Image
              </div>
            )}
          </div>

          <div className="flex-grow">
            <div className="flex items-center">
              <span className="font-medium neon-text">
                {getTranslatedString(skill.name)}
              </span>
            </div>

            {desc && (
              <div className="text-sm text-gray-400 mt-1">
                {formatColorText(desc)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
