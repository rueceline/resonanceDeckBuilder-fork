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
  commodityDb?: Record<number, any>;
}

function buildCoreImageSrc(
  kind: "bottom" | "icon",
  coreId: string,
  ext: "webp"
) {
  return `/assets/UI/core/${kind}_${coreId}.${ext}`;
}

function handleCoreImgError(
  e: React.SyntheticEvent<HTMLImageElement>,
  kind: "bottom" | "icon",
  coreId: string
) {
  const img = e.currentTarget;
  const cur = img.getAttribute("src") || "";
  if (!cur) return;

  // wepb fallback은 경로 확정 없이 임의 변경 금지(요청사항)라서 여기서는 루프 방지만.
  if (cur.endsWith(".webp")) {
    return;
  }
}

function replaceFirstToken(template: string, value: string) {
  if (template.includes("%s")) return template.replace("%s", value);
  if (template.includes("%d")) return template.replace("%d", value);
  return `${template} ${value}`;
}

function formatRange(min: number, max: number) {
  if (min === max) return String(min);
  return `${min} ~ ${max}`;
}

function isDecimal(n: number) {
  return !Number.isInteger(n);
}

function isPercentType(entry: any) {
  // 1) 百分比型는 기본적으로 percent
  const aType = String(entry?.aType ?? "");
  if (aType.includes("百分比")) return true;
  if (aType.toLowerCase().includes("percent")) return true;

  // 3) 一般型 이지만 소수점 값은 *100
  const min = Number(entry?.aNumMin);
  const max = Number(entry?.aNumMax);
  if (Number.isFinite(min) && isDecimal(min)) return true;
  if (Number.isFinite(max) && isDecimal(max)) return true;

  return false;
}

function resolveEntryValue(entry: any, preferMax: boolean) {
  const pct = isPercentType(entry);

  // percent형은 P 필드를 우선 사용(있으면)
  const minP = Number(entry?.aNumMinP);
  const maxP = Number(entry?.aNumMaxP);

  const hasP = Number.isFinite(minP) || Number.isFinite(maxP);

  if (pct && hasP) {
    const a = Number.isFinite(minP) ? minP : 0;
    const b = Number.isFinite(maxP) ? maxP : a;

    // 2) min/max 둘다 0이면 표기 안해야함
    if (a === 0 && b === 0) {
      return { kind: "none", percent: true };
    }

    if (preferMax) {
      return { kind: "single", value: b, percent: true };
    }

    return {
      kind: a === b ? "single" : "range",
      value: a,
      min: a,
      max: b,
      percent: true,
    };
  }

  // 일반형은 aNumMin/aNumMax 사용
  const min = Number(entry?.aNumMin);
  const max = Number(entry?.aNumMax);

  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);

  if (hasMin || hasMax) {
    const a = hasMin ? min : 0;
    const b = hasMax ? max : a;

    // 2) min/max 둘다 0이면 표기 안해야함 (일반형도 동일 규칙 적용)
    if (a === 0 && b === 0) {
      return { kind: "none", percent: pct };
    }

    if (preferMax) {
      return { kind: "single", value: b, percent: pct };
    }

    return {
      kind: a === b ? "single" : "range",
      value: a,
      min: a,
      max: b,
      percent: pct,
    };
  }

  const r = Number(entry?.randomConstant);
  if (Number.isFinite(r) && r !== 0) {
    return { kind: "random", value: r, percent: false };
  }

  return { kind: "none", percent: pct };
}

function buildEntryLine(
  getTranslatedString: (k: string) => string,
  entry: any,
  preferMax: boolean
) {
  const textKey = String(entry?.text ?? "");
  const textTpl = textKey ? getTranslatedString(textKey) : "";

  const v = resolveEntryValue(entry, preferMax);

  if (!textTpl) {
    return { text: "", valueText: "" };
  }

  if (v.kind === "none") {
    // 값이 없으면 텍스트만 출력(규칙 2 반영)
    return { text: textTpl.replace(/%%/g, "%"), valueText: "" };
  }

  if (v.kind === "random") {
    const rendered = replaceFirstToken(textTpl, String(v.value)).replace(
      /%%/g,
      "%"
    );
    return { text: rendered, valueText: "" };
  }

  // single
  if (v.kind === "single") {
    let n = Number((v as any).value);
    if (!Number.isFinite(n)) n = 0;

    // 1) 百分比型는 기본적으로 *100
    // 3) 一般型 이지만 소수점 값은 *100 (isPercentType에서 이미 true)
    if ((v as any).percent) {
      n = n * 100;
    }

    // 템플릿이 이미 %s% / %d% 형태면, 값에 %를 덧붙이지 않음
    const tokenAlreadyHasPercent =
      textTpl.includes("%s%") || textTpl.includes("%d%");

    const valueStr =
      (v as any).percent && !tokenAlreadyHasPercent ? `${n}%` : `${n}`;

    const rendered = replaceFirstToken(textTpl, valueStr).replace(/%%/g, "%");
    return { text: rendered, valueText: "" };
  }

  // range
  let a = Number((v as any).min);
  let b = Number((v as any).max);
  if (!Number.isFinite(a)) a = 0;
  if (!Number.isFinite(b)) b = a;

  if ((v as any).percent) {
    a = a * 100;
    b = b * 100;
  }

  const rangeText = formatRange(a, b);

  const tokenAlreadyHasPercent =
    textTpl.includes("%s%") || textTpl.includes("%d%");

  const valueStr =
    (v as any).percent && !tokenAlreadyHasPercent
      ? `${rangeText}%`
      : `${rangeText}`;

  const rendered = replaceFirstToken(textTpl, valueStr).replace(/%%/g, "%");
  return { text: rendered, valueText: "" };
}

export function TrainWeaponDetailsModal({
  isOpen,
  onClose,
  weaponId,
  weaponEntry,
  data,
  commodityDb,
  getTranslatedString,
}: TrainWeaponDetailsModalProps) {
  if (!weaponEntry) return null;

  const rec = weaponEntry?.rec ?? weaponEntry;

  const nameKey = String(rec?.name ?? "") || weaponId;
  const quality = String(rec?.quality ?? "");
  const descKey = String(rec?.des ?? "");
  const imagePath = String(rec?.tipsPath ?? "") || "";

  // 종류(태그 조인 결과)
  const typeWeapon = rec?.typeWeapon || null; // {id, tagName}
  const hitEventType = Array.isArray(rec?.hitEventType) ? rec.hitEventType : []; // [{id, tagName}]

  // 전력부하/속도 (추출 결과)
  const powerLoad = rec?.powerLoad ?? null; // {value} or ranges
  const speed = rec?.speed ?? null; // {kind, value} or ranges (현재 출력은 유지/미추가)

  // 코어 조건
  const coreList = Array.isArray(rec?.coreList) ? rec.coreList : []; // [{id, level, name}]

  // 무장 효과(엔트리)
  const growUpEntries = Array.isArray(rec?.growUpEntryList)
    ? rec.growUpEntryList
    : [];

  // 획득 경로
  const getwayList = Array.isArray(rec?.Getway) ? rec.Getway : [];

  // equipment-details-modal.tsx 방식: commodityDb 전체 스캔 조인
  const exchangeMaterials = (() => {
    if (!commodityDb) return [];

    const targetIdRaw = Number(rec?.id ?? weaponId);
    if (!Number.isFinite(targetIdRaw)) return [];

    const out: { nameKey: string; num: number }[] = [];

    for (const commodity of Object.values(commodityDb)) {
      if (!commodity) continue;

      const resultList = Array.isArray(commodity.commodityItemList)
        ? commodity.commodityItemList
        : [];

      const hit = resultList.some((it: any) => Number(it?.id) === targetIdRaw);
      if (!hit) continue;

      const moneyList = Array.isArray(commodity.moneyList)
        ? commodity.moneyList
        : [];

      for (const m of moneyList) {
        if (!m?.nameKey || !m?.num) continue;

        out.push({
          nameKey: m.nameKey,
          num: Number(m.num),
        });
      }
    }

    const merged: Record<string, number> = {};
    for (const it of out) {
      merged[it.nameKey] = (merged[it.nameKey] || 0) + it.num;
    }

    return Object.entries(merged).map(([nameKey, num]) => ({
      nameKey,
      num,
    }));
  })();

  const getQualityBgColor = (q: string) => {
    switch (q) {
      case "Orange":
        return "bg-gradient-to-br from-orange-500 to-red-500";
      case "Golden":
        return "bg-gradient-to-br from-yellow-500 to-amber-500";
      case "Purple":
        return "bg-gradient-to-br from-purple-500 to-indigo-500";
      case "Blue":
        return "bg-gradient-to-br from-blue-500 to-cyan-500";
      case "Green":
        return "bg-gradient-to-br from-green-500 to-emerald-500";
      default:
        return "bg-gradient-to-br from-gray-400 to-gray-500";
    }
  };

  function renderPowerLoad() {
    if (!powerLoad) return null;

    // 타입이 정해져 있다는 전제 하에: value / aNumMin/aNumMax / aNumMinP/aNumMaxP만 사용
    const v = powerLoad?.value;
    if (typeof v === "number") {
      return <div>전력 부하: {String(v)}</div>;
    }

    const min = powerLoad?.aNumMin;
    const max = powerLoad?.aNumMax;
    if (typeof min === "number" || typeof max === "number") {
      const a = typeof min === "number" ? min : 0;
      const b = typeof max === "number" ? max : a;
      return <div>전력 부하: {formatRange(a, b)}</div>;
    }

    const minP = powerLoad?.aNumMinP;
    const maxP = powerLoad?.aNumMaxP;
    if (typeof minP === "number" || typeof maxP === "number") {
      const a = typeof minP === "number" ? minP : 0;
      const b = typeof maxP === "number" ? maxP : a;
      return <div>전력 부하: {formatRange(a, b)}%</div>;
    }

    return null;
  }

  function renderTagList() {
    const parts: string[] = [];

    if (typeWeapon?.tagName) {
      const k = String(typeWeapon.tagName);
      if (k) parts.push(getTranslatedString(k));
    }

    const hitParts = hitEventType
      .map((t: any) => {
        const k = String(t?.tagName ?? "");
        return k ? getTranslatedString(k) : "";
      })
      .filter((x: string) => x.trim().length > 0);

    const main = parts.filter((x) => x.trim().length > 0).join(" · ");

    if (hitParts.length === 0) {
      return main ? <div>종류: {main}</div> : null;
    }

    return (
      <div className="space-y-1">
        {main ? <div>종류: {main}</div> : null}
        <div className="text-xs text-gray-400">
          적용 태그: {hitParts.join(", ")}
        </div>
      </div>
    );
  }

  function renderCoreList() {
    if (coreList.length === 0) return null;

    return (
      <div className="mb-4 character-detail-section">
        <h5 className="character-detail-section-title">
          {getTranslatedString("encyclopedia.field.core_need") || "코어 조건"}
        </h5>

        <div className="flex flex-wrap items-end gap-3">
          {coreList.map((c: any) => {
            const coreId = String(c?.id ?? "");
            const level = typeof c?.level === "number" ? c.level : 0;

            const bottomSrc = buildCoreImageSrc("bottom", coreId, "webp");
            const iconSrc = buildCoreImageSrc("icon", coreId, "webp");

            return (
              <div
                key={`${coreId}-${level}`}
                className="flex flex-col items-center gap-1"
              >
                <div className="relative w-12 h-12">
                  <img
                    src={bottomSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                    onError={(e) => handleCoreImgError(e, "bottom", coreId)}
                  />
                  <img
                    src={iconSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                    onError={(e) => handleCoreImgError(e, "icon", coreId)}
                  />
                </div>

                <div className="text-xs font-semibold text-gray-200 leading-none">
                  Lv{String(level)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderEntriesBlock(title: string, entries: any[]) {
    if (!entries || entries.length === 0) return null;

    return (
      <div className="mb-4 character-detail-section">
        <h5 className="character-detail-section-title">{title}</h5>

        <div className="space-y-2">
          {entries.map((e: any, idx: number) => {
            const nameKey2 = String(e?.name ?? "");
            const name = nameKey2 ? getTranslatedString(nameKey2) : "";

            const line = buildEntryLine(getTranslatedString, e, false);
            const text = line.text || "";

            if (!text && !name) return null;

            return (
              <div key={`${String(e?.id ?? "")}-${idx}`} className="text-sm text-gray-300">
                {text ? (
                  <div
                    className="leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatColorText(text) }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderGetway() {
    if (!getwayList || getwayList.length === 0) return null;

    return (
      <div className="mb-4 character-detail-section">
        <h5 className="character-detail-section-title">
          {getTranslatedString("encyclopedia.field.getway") || "획득 방법"}
        </h5>

        <ul className="space-y-1 list-disc list-inside">
          {getwayList.map((method: any, index: number) => {
            const dnKey = String(method?.DisplayName ?? "");
            const uiKey = String(method?.UIName ?? "");

            const lineKey = dnKey || uiKey;
            if (!lineKey) return null;

            return (
              <li key={index} className="text-sm text-gray-300">
                {formatColorText(getTranslatedString(lineKey))}
              </li>
            );
          })}
        </ul>

        {exchangeMaterials.length > 0 && (
          <div className="mt-3">
            <div className="text-sm font-semibold text-gray-200">
              {getTranslatedString("exchange_materials") || "Exchange Materials"}
            </div>

            <ul className="mt-1 ml-4 list-disc list-inside space-y-0.5">
              {exchangeMaterials.map((x) => (
                <li key={x.nameKey} className="text-sm text-gray-300">
                  {getTranslatedString(x.nameKey)} × {x.num}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

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
          {getTranslatedString("encyclopedia.train_weapon_details") ||
            "열차무장 상세"}
        </h3>
      }
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
      maxWidth="max-w-3xl"
      closeOnOutsideClick={true}
    >
      <div className="p-4">
        <div className="flex mb-4">
          <div
            className={`w-16 h-16 ${getQualityBgColor(
              quality
            )} rounded-lg mr-4 overflow-hidden neon-border flex items-center justify-center`}
          >
            {imagePath ? (
              <img
                src={imagePath || "/placeholder.svg"}
                alt={getTranslatedString(nameKey)}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const textElement = document.createElement("span");
                  textElement.className = "text-xs text-center";
                  textElement.textContent = getTranslatedString(nameKey).substring(
                    0,
                    2
                  );
                  e.currentTarget.parentElement?.appendChild(textElement);
                }}
              />
            ) : (
              <span className="text-xs text-center">
                {getTranslatedString(nameKey).substring(0, 2)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-base font-semibold neon-text truncate">
              {getTranslatedString(nameKey)}
            </h4>

            <div className="text-sm text-gray-400 space-y-1 mt-1">
              {renderTagList()}
              {renderPowerLoad()}
            </div>
          </div>
        </div>

        {descKey ? (
          <div className="mb-4 character-detail-section">
            <h5 className="character-detail-section-title">
              {getTranslatedString("encyclopedia.field.desc") || "설명"}
            </h5>
            <p className="text-sm text-gray-300">
              {formatColorText(getTranslatedString(descKey))}
            </p>
          </div>
        ) : null}

        {renderCoreList()}

        {renderEntriesBlock(
          getTranslatedString("encyclopedia.field.effects_growup") ||
            "성장 효과",
          growUpEntries
        )}

        {renderGetway()}
      </div>
    </Modal>
  );
}
