"use client";

import { useCallback } from "react";
import type { Database } from "../../types";
import type {
  SelectedCard,
  PresetCard,
  Preset,
  EquipmentSlot,
  Result,
  AwakeningInfo,
} from "./types";
import {
  encodePreset,
  decodePreset,
  encodePresetForUrl,
} from "../../utils/presetCodec";

const DISCARD_CARD_ID = "10600474";
const DISCARD_SKILL_ID = "12303725";
const DISCARD_OWNER_ID = 10000001;

export function usePresets(
  data: Database | null,
  selectedCharacters: number[],
  leaderCharacter: number,
  selectedCards: SelectedCard[],
  battleSettings: {
    isLeaderCardOn: boolean;
    isSpCardOn: boolean;
    keepCardNum: number;
    discardType: number;
    otherCard: number;
  },
  equipment: EquipmentSlot[],
  awakening: AwakeningInfo, // 각성 정보 추가
  clearAll: () => void,
  importPresetObject: (preset: any) => Result
) {
  // 프리셋 객체 생성
  const createPresetObject = useCallback(
    (includeEquipment = false, includeAwakening = false) => {
      // 선택된 카드를 필요한 형식으로 변환
      const formattedCardList = selectedCards.map((card) => {
        const id = String(card.id);
        const isDiscard = id === DISCARD_CARD_ID;

        // === discard 카드 (고정 규칙) ===
        if (isDiscard) {
          return {
            id: DISCARD_CARD_ID,
            ownerId: DISCARD_OWNER_ID,
            skillId: DISCARD_SKILL_ID,
            targetType: 0,
            useType: card.useType,
            useParam: card.useParam,
            useParamMap: [], // ★ 반드시 배열
            equipIdList: [],
          };
        }

        // === 일반 카드 (기존 로직 유지) ===
        const cardObj: any = {
          id,
          ownerId: card.ownerId,
          targetType: 0,
          useType: card.useType,
          useParam: card.useParam,
          equipIdList: [],
        };

        if (card.skillId != null && card.skillId !== -1) {
          cardObj.skillId = String(card.skillId);
        } else {
          const cardData = data?.cards?.[id];
          if (!cardData || !cardData.skillId) {
            throw new Error("missing skillId for card " + id);
          }
          cardObj.skillId = String(cardData.skillId);
        }

        if (typeof card.skillIndex === "number") {
          cardObj.skillIndex = card.skillIndex;
        }

        if (Array.isArray(card.useParamMap)) {
          cardObj.useParamMap = card.useParamMap;
        }

        return cardObj;
      });

      // 카드 ID 맵 생성
      const cardIdMap: Record<string, number> = {};
      selectedCards.forEach((card) => {
        cardIdMap[card.id] = 1;
      });

      // 기본 프리셋 객체 생성
      const preset: Preset = {
        roleList: selectedCharacters,
        header: leaderCharacter,
        cardList: formattedCardList,
        cardIdMap: cardIdMap,
        isLeaderCardOn: battleSettings.isLeaderCardOn,
        isSpCardOn: battleSettings.isSpCardOn,
        keepCardNum: battleSettings.keepCardNum,
        discardType: battleSettings.discardType + 1, // discardType에 +1
        otherCard: battleSettings.otherCard,
      };

      // 장비 정보 포함 여부
      if (includeEquipment) {
        // 장비 정보 생성
        const equipmentData: Record<
          number,
          [string | null, string | null, string | null]
        > = {};

        // 캐릭터가 있는 슬롯에 대해서만 장비 정보 추가
        selectedCharacters.forEach((charId, index) => {
          if (charId !== -1) {
            const charEquipment = equipment[index];
            if (
              charEquipment.weapon ||
              charEquipment.armor ||
              charEquipment.accessory
            ) {
              equipmentData[index] = [
                charEquipment.weapon,
                charEquipment.armor,
                charEquipment.accessory,
              ];
            }
          }
        });

        // 장비 정보가 있는 경우에만 추가
        if (Object.keys(equipmentData).length > 0) {
          preset.equipment = equipmentData;
        }
      }

      // 각성 정보 포함 여부
      if (includeAwakening && Object.keys(awakening).length > 0) {
        preset.awakening = awakening;
      }

      return preset;
    },
    [
      selectedCharacters,
      leaderCharacter,
      selectedCards,
      battleSettings,
      equipment,
      awakening,
      data,
    ]
  );

  // 프리셋 내보내기
  const exportPreset = useCallback(() => {
    try {
      const preset = createPresetObject(false, false); // 장비 정보와 각성 정보 제외
      const base64String = encodePreset(preset);
      navigator.clipboard.writeText(base64String);
      return { success: true, message: "export_success" };
    } catch (error) {
      return { success: false, message: "export_failed" };
    }
  }, [createPresetObject]);

  // 프리셋을 문자열로 내보내기
  const exportPresetToString = useCallback(() => {
    try {
      const preset = createPresetObject(false, false); // 장비 정보 각성 정보 제외
      return encodePreset(preset);
    } catch (error) {
      return "";
    }
  }, [createPresetObject]);

  // 클립보드에서 프리셋 가져오기
  const importPreset = useCallback(async () => {
    try {
      const base64Text = await navigator.clipboard.readText();

      // 프리셋 디코딩
      const preset = decodePreset(base64Text);

      if (!preset) {
        throw new Error("invalid_preset_format");
      }

      // 프리셋 구조 검증
      if (
        !preset.roleList ||
        !Array.isArray(preset.roleList) ||
        preset.roleList.length !== 5
      ) {
        throw new Error("invalid_rolelist");
      }

      if (!preset.cardList || !Array.isArray(preset.cardList)) {
        throw new Error("invalid_cardlist");
      }

      // 프리셋 객체 가져오기
      return importPresetObject(preset);
    } catch (error) {
      return { success: false, message: "import_failed" };
    }
  }, [importPresetObject]);

  // 프리셋 문자열 디코딩
  const decodePresetString = useCallback((base64Text: string) => {
    try {
      const preset = decodePreset(base64Text);

      if (!preset) {
        return null;
      }

      // 프리셋 구조 검증
      if (
        !preset.roleList ||
        !Array.isArray(preset.roleList) ||
        preset.roleList.length !== 5
      ) {
        return null;
      }

      if (!preset.cardList || !Array.isArray(preset.cardList)) {
        return null;
      }

      return preset;
    } catch (error) {
      console.error("Error decoding preset:", error);
      return null;
    }
  }, []);

  // 공유 URL 생성
  const createShareableUrl = useCallback(() => {
    try {
      const preset = createPresetObject(true, true); // 장비 정보와 각성 정보 포함
      const encodedPreset = encodePresetForUrl(preset);

      // 현재 URL에서 기본 경로 가져오기
      const baseUrl = window.location.origin;
      const langPath = window.location.pathname.split("/")[1] || "ko";

      // 공유 URL 생성
      const shareableUrl = `${baseUrl}/${langPath}?code=${encodedPreset}`;
      return { success: true, url: shareableUrl };
    } catch (error) {
      return { success: false, url: "" };
    }
  }, [createPresetObject]);

  // 루트 공유 URL 생성
  const createRootShareableUrl = useCallback(() => {
    try {
      const preset = createPresetObject(true, true); // 장비 정보와 각성 정보 포함
      const encodedPreset = encodePresetForUrl(preset);

      // 루트 URL 가져오기
      const rootUrl = window.location.origin;

      // 공유 URL 생성
      const shareableUrl = `${rootUrl}?code=${encodedPreset}`;
      return { success: true, url: shareableUrl };
    } catch (error) {
      return { success: false, url: "" };
    }
  }, [createPresetObject]);

  return {
    exportPreset,
    exportPresetToString,
    importPreset,
    decodePresetString,
    createShareableUrl,
    createRootShareableUrl,
    createPresetObject,
  };
}
