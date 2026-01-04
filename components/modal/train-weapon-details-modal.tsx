// src/components/ui/modal/train-weapon-details-modal.tsx
"use client";

import type React from "react";
import type { Database } from "../../types/index";
import { Modal } from "./Modal";
import { formatColorText } from "../../utils/format-text";

export interface TrainWeaponDetailsModalProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;

  weaponId: string;
  weaponEntry: any; // home_weapon_db row (HomeWeaponFactory)
  data: Database;

  getTranslatedString: (key: string) => string;
}

function safeString(v: any) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function isMeaningful(v: any) {
  const s = safeString(v).trim();
  if (!s) return false;
  if (s === "-1") return false;
  return true;
}

export function TrainWeaponDetailsModal({
  isOpen,
  onClose,
  weaponId,
  weaponEntry,
  data,
  getTranslatedString,
}: TrainWeaponDetailsModalProps) {
  if (!weaponEntry) return null;

  const rec = weaponEntry?.rec ?? weaponEntry;

  const nameKey = safeString(rec?.nameTok) || safeString(rec?.name) || weaponId;
  const quality = safeString(rec?.quality);

  const weaponType = safeString(rec?.mod) || safeString(rec?.weaponType) || safeString(rec?.typeWeapon) || "";
  const powerLoad =
    rec?.powerCost ?? rec?.energyCost ?? rec?.costPower ?? rec?.power ?? null;

  const coreList = Array.isArray(rec?.coreList) ? rec.coreList : [];
  const descKey = safeString(rec?.des);

  const imagePath =
    safeString(rec?.imagePath) ||
    safeString(rec?.tipsPath) ||
    safeString(rec?.iconPath) ||
    "";

  // 효과 계열(팩토리 실제 필드명 기준)
  const effects: { label: string; value: any; isRich?: boolean }[] = [];
  if (isMeaningful(rec?.specialEffects)) effects.push({ label: "무장효과", value: rec?.specialEffects, isRich: true });
  if (isMeaningful(rec?.XEffects)) effects.push({ label: "XEffects", value: rec?.XEffects, isRich: true });
  if (isMeaningful(rec?.YEffects)) effects.push({ label: "YEffects", value: rec?.YEffects, isRich: true });
  if (isMeaningful(rec?.ZEffects)) effects.push({ label: "ZEffects", value: rec?.ZEffects, isRich: true });
  if (isMeaningful(rec?.timeLineEffect)) effects.push({ label: "timeLineEffect", value: rec?.timeLineEffect });
  if (isMeaningful(rec?.effectTypeEffect)) effects.push({ label: "effectTypeEffect", value: rec?.effectTypeEffect });

  // 제작/교환 재료 (HomeWeaponFactory: materialList + goldCost 등)
  const materialList = Array.isArray(rec?.materialList) ? rec.materialList : [];
  const goldCost = rec?.goldCost ?? null;

  const itemIdIndex =
    (data as any)?.itemIdIndex ??
    (data as any)?.item_id_index ??
    (data as any)?.ItemIdIndex ??
    null;

  const resolvedMaterials = materialList
    .map((m: any) => {
      const mid = safeString(m?.id);
      const num = Number(m?.num) || 0;
      if (!mid || num <= 0) return null;

      const idxEntry = itemIdIndex ? itemIdIndex[mid] : null;
      const matNameKey =
        safeString(idxEntry?.nameTok) || safeString(idxEntry?.rec?.name) || mid;

      return { id: mid, nameKey: matNameKey, num };
    })
    .filter(Boolean) as { id: string; nameKey: string; num: number }[];

  return (
    <Modal
      isOpen={isOpen}
      onClose={(e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        onClose(e);
      }}
      title={
        <h3 className="text-lg font-bold neon-text">
          {getTranslatedString("encyclopedia.train_weapon_details") || "열차무장 상세"}
        </h3>
      }
      footer={
        <div className="flex justify-end">
          <button onClick={() => onClose()} className="neon-button px-4 py-2 rounded-lg text-sm">
            Close
          </button>
        </div>
      }
      maxWidth="max-w-3xl"
      closeOnOutsideClick={true}
    >
      <div className="p-4">
        <div className="flex mb-4 gap-3">
          <div className="w-20 h-16 bg-gray-700 rounded-lg overflow-hidden neon-border flex items-center justify-center">
            {imagePath ? (
              <img
                src={imagePath || "/placeholder.svg"}
                alt={getTranslatedString(nameKey)}
                className="w-full h-full object-contain p-1"
                onError={(ev) => {
                  ev.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="text-xs text-center">{getTranslatedString(nameKey).substring(0, 2)}</span>
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-base font-semibold neon-text truncate">{getTranslatedString(nameKey)}</h4>
            <div className="text-sm text-gray-400 space-y-1 mt-1">
              {quality ? <div>레어리티: {quality}</div> : null}
              {weaponType ? <div>타입: {weaponType}</div> : null}
              {powerLoad !== null ? <div>전력 부하: {String(powerLoad)}</div> : null}
              <div>코어 조건: {coreList.length}</div>
            </div>
          </div>
        </div>

        {descKey ? (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-1 neon-text">
              {getTranslatedString("encyclopedia.field.desc") || "설명"}
            </div>
            <div
              className="text-sm text-gray-200 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatColorText(getTranslatedString(descKey)) }}
            />
          </div>
        ) : null}

        {coreList.length > 0 ? (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-1 neon-text">코어 조건</div>
            <pre className="text-xs bg-black/40 border border-white/10 rounded-lg p-2 overflow-auto">
              {JSON.stringify(coreList, null, 2)}
            </pre>
          </div>
        ) : null}

        {effects.length > 0 ? (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-1 neon-text">무장 효과</div>

            <div className="space-y-2">
              {effects.map((e, idx) => {
                if (e.isRich) {
                  return (
                    <div key={idx} className="bg-black/40 border border-white/10 rounded-lg p-2">
                      <div className="text-xs text-gray-400 mb-1">{e.label}</div>
                      <div
                        className="text-sm text-gray-200 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: formatColorText(getTranslatedString(safeString(e.value))),
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <div key={idx} className="bg-black/40 border border-white/10 rounded-lg p-2">
                    <div className="text-xs text-gray-400 mb-1">{e.label}</div>
                    <div className="text-sm text-gray-200">{safeString(e.value)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {(resolvedMaterials.length > 0 || (goldCost !== null && Number(goldCost) > 0)) ? (
          <div className="mb-2">
            <div className="text-sm font-semibold mb-1 neon-text">
              {getTranslatedString("encyclopedia.field.exchange") || "교환/제작 재료"}
            </div>

            {goldCost !== null && Number(goldCost) > 0 ? (
              <div className="text-sm bg-black/40 border border-white/10 rounded-lg px-3 py-2 mb-2 flex justify-between">
                <span>골드</span>
                <span className="text-gray-300 ml-2">{String(goldCost)}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              {resolvedMaterials.map((m) => (
                <div
                  key={`${m.id}-${m.num}`}
                  className="text-sm bg-black/40 border border-white/10 rounded-lg px-3 py-2 flex justify-between"
                >
                  <span className="truncate">{getTranslatedString(m.nameKey)}</span>
                  <span className="text-gray-300 ml-2">{m.num}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 text-xs text-gray-500">
          특정 항목이 비어 보이면, build_db.mjs에서 HomeWeaponFactory를 어떤 필드까지 싣는지/필드명이 맞는지 확인해야 함.
        </div>
      </div>
    </Modal>
  );
}
