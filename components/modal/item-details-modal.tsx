// src/components/ui/modal/item-details-modal.tsx
"use client";

import type React from "react";
import type { Database } from "../../types/index";
import { Modal } from "./Modal";
import { formatColorText } from "../../utils/format-text";

export interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;

  itemId: string;
  itemEntry: any; // item_id_index entry: { kind, rec, nameTok }
  data: Database;

  getTranslatedString: (key: string) => string;
}

function safeString(v: any) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function pickFirstString(rec: any, keys: string[]) {
  for (const k of keys) {
    const v = rec?.[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return "";
}

function pickFirstArray(rec: any, keys: string[]) {
  for (const k of keys) {
    const v = rec?.[k];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return [];
}

export function ItemDetailsModal({
  isOpen,
  onClose,
  itemId,
  itemEntry,
  data,
  getTranslatedString,
}: ItemDetailsModalProps) {
  if (!itemEntry) return null;

  // item_id_index: { kind, rec, nameTok }
  const rec = itemEntry?.rec ?? itemEntry;

  // ItemFactory / SourceMaterialFactory 공통 필드
  const nameKey = safeString(itemEntry?.nameTok) || safeString(rec?.name) || itemId;
  const quality = safeString(rec?.quality);

  const descKey = pickFirstString(rec, ["des"]);
  const typeText =
    safeString(rec?.mod) ||
    safeString(rec?.playerParkItemType) ||
    safeString(rec?.saletype) ||
    safeString(rec?.useType) ||
    "";

  // 이미지 경로: ItemFactory/SourceMaterialFactory에 iconPath, tipsPath 등이 존재
  const iconPath =
    safeString(rec?.iconPath) ||
    safeString(rec?.tipsPath) ||
    safeString(rec?.buyPath) ||
    safeString(rec?.textIcon) ||
    "";

  // 획득 방법: ItemFactory/SourceMaterialFactory => Getway: [{ DisplayName, ... }, ...]
  const getway = pickFirstArray(rec, ["Getway"]);

  // “효과”는 팩토리에서 별도 텍스트 필드가 없고 rewardList로만 표현되는 경우가 많음
  // (build_db가 어떤 변환을 했는지에 따라 없을 수도 있음)
  const rewardList = pickFirstArray(rec, ["rewardList"]);

  // 교환 재료: item_to_commodity_ids + commodity_db + item_id_index 필요
  const commodityDb =
    (data as any)?.commodityDb ??
    (data as any)?.commodity_db ??
    (data as any)?.CommodityDb ??
    null;

  const itemToCommodityIds =
    (data as any)?.itemToCommodityIds ??
    (data as any)?.item_to_commodity_ids ??
    (data as any)?.ItemToCommodityIds ??
    null;

  const itemIdIndex =
    (data as any)?.itemIdIndex ??
    (data as any)?.item_id_index ??
    (data as any)?.ItemIdIndex ??
    null;

  const exchangeMaterials = (() => {
    if (!commodityDb || !itemToCommodityIds || !itemIdIndex) return [];

    const cids = itemToCommodityIds[itemId];
    if (!Array.isArray(cids)) return [];

    const out: { nameKey: string; num: number }[] = [];

    for (const cid of cids) {
      const commodity = commodityDb[cid];
      if (!commodity) continue;

      const moneyList = Array.isArray(commodity?.moneyList) ? commodity.moneyList : [];
      for (const m of moneyList) {
        const mid = safeString(m?.moneyID);
        if (!mid) continue;

        const idxEntry = itemIdIndex[mid];
        const matNameKey =
          safeString(idxEntry?.nameTok) || safeString(idxEntry?.rec?.name) || mid;

        out.push({
          nameKey: matNameKey,
          num: Number(m?.moneyNum) || 0,
        });
      }
    }

    return out;
  })();

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
          {getTranslatedString("encyclopedia.item_details") || "아이템 상세"}
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
          <div className="w-16 h-16 bg-gray-700 rounded-lg overflow-hidden neon-border flex items-center justify-center">
            {iconPath ? (
              <img
                src={iconPath || "/placeholder.svg"}
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
              {quality ? <div>품질: {quality}</div> : null}
              {typeText ? <div>타입: {typeText}</div> : null}
              {safeString(itemEntry?.kind) ? <div>factoryKind: {safeString(itemEntry?.kind)}</div> : null}
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

        {rewardList.length > 0 ? (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-1 neon-text">
              {getTranslatedString("encyclopedia.field.effect") || "효과"}
            </div>
            <pre className="text-xs bg-black/40 border border-white/10 rounded-lg p-2 overflow-auto">
              {JSON.stringify(rewardList, null, 2)}
            </pre>
          </div>
        ) : null}

        {getway.length > 0 ? (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-1 neon-text">
              {getTranslatedString("encyclopedia.field.obtain") || "획득방법"}
            </div>
            <ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
              {getway.map((g: any, idx: number) => {
                const label = getTranslatedString(safeString(g?.DisplayName) || "");
                return <li key={idx}>{label || JSON.stringify(g)}</li>;
              })}
            </ul>
          </div>
        ) : null}

        {exchangeMaterials.length > 0 ? (
          <div className="mb-2">
            <div className="text-sm font-semibold mb-1 neon-text">
              {getTranslatedString("encyclopedia.field.exchange") || "교환재료"}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {exchangeMaterials.map((m, idx) => (
                <div
                  key={`${m.nameKey}-${idx}`}
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
          특정 항목이 비어 보이면, build_db.mjs에서 해당 팩토리(예: ItemFactory/SourceMaterialFactory)를 어디까지 싣는지와
          필드명이 맞는지 확인해야 함.
        </div>
      </div>
    </Modal>
  );
}
