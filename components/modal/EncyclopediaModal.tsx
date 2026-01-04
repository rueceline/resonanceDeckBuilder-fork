// src/components/ui/modal/EncyclopediaModal.tsx
"use client";

import { useMemo, useState } from "react";
import type { Database } from "../../types/index";
import { Modal } from "./Modal";
import { Info } from "lucide-react";
import { EquipmentDetailsModal } from "./equipment-details-modal";
import { ItemDetailsModal } from "./item-details-modal";
import { TrainWeaponDetailsModal } from "./train-weapon-details-modal";

type TabKey = "equip" | "item" | "train";

export interface EncyclopediaModalProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;
  getSkill?: (skillId: number) => any
  data: Database;
  getTranslatedString: (key: string) => string;
}

function getQualityBgColor(quality: string) {
  switch (quality) {
    case "Orange":
      return "bg-gradient-to-br from-orange-500 to-red-500 bg-opacity-70";
    case "Golden":
      return "bg-gradient-to-br from-yellow-500 to-amber-500 bg-opacity-70";
    case "Purple":
      return "bg-gradient-to-br from-purple-500 to-indigo-500 bg-opacity-70";
    case "Blue":
      return "bg-gradient-to-br from-blue-500 to-cyan-500 bg-opacity-70";
    case "Green":
      return "bg-gradient-to-br from-green-500 to-emerald-500 bg-opacity-70";
    default:
      return "bg-gradient-to-br from-gray-400 to-gray-500 bg-opacity-70";
  }
}

function safeString(v: any) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

export function EncyclopediaModal({
  isOpen,
  onClose,
  getSkill,
  data,
  getTranslatedString,
}: EncyclopediaModalProps) {
  const [tab, setTab] = useState<TabKey>("equip");
  const [searchTerm, setSearchTerm] = useState("");

  const [showEquipDetailsId, setShowEquipDetailsId] = useState<string | null>(
    null
  );
  const [showItemDetailsId, setShowItemDetailsId] = useState<string | null>(
    null
  );
  const [showTrainDetailsId, setShowTrainDetailsId] = useState<string | null>(
    null
  );

  const [equipSortBy, setEquipSortBy] = useState<"quality" | "name">("quality");
  const [equipSortDirection, setEquipSortDirection] = useState<"asc" | "desc">(
    "desc"
  );

  const equipments = useMemo(() => {
    const list = (data as any)?.equipments
      ? Object.values((data as any).equipments)
      : [];
    return Array.isArray(list) ? (list as any[]) : [];
  }, [data]);

  const itemIdIndex = useMemo(() => {
    const idx =
      (data as any)?.itemIdIndex ?? (data as any)?.item_id_index ?? null;
    if (!idx || typeof idx !== "object") return {};
    return idx as Record<string, any>;
  }, [data]);

  const homeWeapons = useMemo(() => {
    const hw =
      (data as any)?.homeWeaponDb ??
      (data as any)?.home_weapon_db ??
      (data as any)?.homeWeapons ??
      null;

    if (Array.isArray(hw)) return hw as any[];
    if (hw && typeof hw === "object") {
      const v = Object.values(hw);
      return Array.isArray(v) ? (v as any[]) : [];
    }
    return [];
  }, [data]);

  const filteredEquipments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const filtered = equipments.filter((e) => {
      if (!q) return true;
      const name = getTranslatedString(safeString(e?.name));
      return name.toLowerCase().includes(q);
    });

    const qualityOrder: Record<string, number> = {
      Orange: 5,
      Golden: 4,
      Purple: 3,
      Blue: 2,
      Green: 1,
    };

    const typeOrder: Record<string, number> = {
      weapon: 3,
      armor: 2,
      accessory: 1,
    };

    const sorted = [...filtered].sort((a, b) => {
      let result = 0;

      if (equipSortBy === "name") {
        result = getTranslatedString(safeString(a?.name)).localeCompare(
          getTranslatedString(safeString(b?.name))
        );

        // (선택) 이름이 같으면 레어리티 -> 타입으로 안정 정렬
        if (result === 0) {
          const qa = qualityOrder[safeString(a?.quality)] || 0;
          const qb = qualityOrder[safeString(b?.quality)] || 0;
          result = qb - qa;

          if (result === 0) {
            const ta = typeOrder[safeString(a?.type)] || 0;
            const tb = typeOrder[safeString(b?.type)] || 0;
            result = tb - ta;
          }
        }
      } else {
        // 레어리티(quality) 우선
        const qa = qualityOrder[safeString(a?.quality)] || 0;
        const qb = qualityOrder[safeString(b?.quality)] || 0;
        result = qb - qa;

        // 레어리티가 같으면 타입(weapon > armor > accessory)
        if (result === 0) {
          const ta = typeOrder[safeString(a?.type)] || 0;
          const tb = typeOrder[safeString(b?.type)] || 0;
          result = tb - ta;
        }
      }

      return equipSortDirection === "asc" ? -result : result;
    });

    return sorted;
  }, [
    equipments,
    searchTerm,
    equipSortBy,
    equipSortDirection,
    getTranslatedString,
  ]);

  const filteredHomeWeapons = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = homeWeapons;

    if (!q) return list;

    return list.filter((r) => {
      const nameKey =
        safeString(r?.nameTok) || safeString(r?.name) || safeString(r?.id);
      const name = getTranslatedString(nameKey);
      return name.toLowerCase().includes(q);
    });
  }, [homeWeapons, searchTerm, getTranslatedString]);

  const selectedEquip = useMemo(() => {
    if (!showEquipDetailsId) return null;
    return (
      equipments.find((e) => String(e?.id) === String(showEquipDetailsId)) ||
      null
    );
  }, [equipments, showEquipDetailsId]);

  const selectedItem = useMemo(() => {
    if (!showItemDetailsId) return null;
    return itemIdIndex[String(showItemDetailsId)] || null;
  }, [itemIdIndex, showItemDetailsId]);

  const selectedTrain = useMemo(() => {
    if (!showTrainDetailsId) return null;
    return (
      homeWeapons.find((r) => String(r?.id) === String(showTrainDetailsId)) ||
      null
    );
  }, [homeWeapons, showTrainDetailsId]);

  const tabButtonClass = (active: boolean) => {
    return [
      "px-3 py-2 rounded-lg text-sm transition-colors",
      active ? "neon-button" : "bg-black/40 hover:bg-black/60",
    ].join(" ");
  };

  return (
    <>
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
            {getTranslatedString("encyclopedia.title") || "Encyclopedia"}
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
        maxWidth="max-w-5xl"
        closeOnOutsideClick={true}
      >
        <div className="p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              className={tabButtonClass(tab === "equip")}
              onClick={() => {
                setTab("equip");
                setSearchTerm("");
              }}
            >
              {getTranslatedString("encyclopedia.tab.equipment") || "장비"}
            </button>
            <button
              className={tabButtonClass(tab === "item")}
              onClick={() => {
                setTab("item");
                setSearchTerm("");
              }}
            >
              {getTranslatedString("encyclopedia.tab.item") || "아이템"}
            </button>
            <button
              className={tabButtonClass(tab === "train")}
              onClick={() => {
                setTab("train");
                setSearchTerm("");
              }}
            >
              {getTranslatedString("encyclopedia.tab.train_weapon") ||
                "열차무장"}
            </button>
          </div>

          <div className="mb-4">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
              placeholder={getTranslatedString("encyclopedia.search") || "검색"}
            />
          </div>

          {tab === "equip" && (
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-6">
              {filteredEquipments.length === 0 ? (
                <div className="col-span-full text-center py-6 text-gray-400">
                  {getTranslatedString("encyclopedia.empty") || "결과 없음"}
                </div>
              ) : (
                filteredEquipments.map((e) => {
                  const name = getTranslatedString(safeString(e?.name));
                  const url = safeString(e?.url);
                  const quality = safeString(e?.quality);

                  return (
                    <div
                      key={String(e?.id)}
                      className="flex flex-col items-center relative"
                    >
                      <div
                        className={[
                          "w-full aspect-square rounded-lg overflow-hidden neon-border relative",
                          getQualityBgColor(quality),
                        ].join(" ")}
                      >
                        {url ? (
                          <img
                            src={url || "/placeholder.svg"}
                            alt={name}
                            className="w-full h-full object-contain p-1"
                            onError={(ev) => {
                              ev.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs text-center">
                              {name.substring(0, 2)}
                            </span>
                          </div>
                        )}

                        <button
                          className="absolute top-1 right-1 bg-black bg-opacity-60 rounded-full p-1 flex items-center justify-center z-10"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setShowEquipDetailsId(String(e?.id));
                          }}
                        >
                          <Info className="w-6 h-6 text-white" />
                        </button>
                      </div>

                      <div className="text-xs font-medium text-center truncate w-full neon-text max-w-full mt-1">
                        {name}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "item" && (
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
              {filteredItems.length === 0 ? (
                <div className="col-span-full text-center py-6 text-gray-400">
                  {getTranslatedString("encyclopedia.empty") || "결과 없음"}
                </div>
              ) : (
                filteredItems.map((it) => {
                  const rec = it?.rec ?? {};
                  const nameKey =
                    safeString(it?.nameTok) || safeString(rec?.name) || it.id;
                  const name = getTranslatedString(nameKey);

                  const quality = safeString(rec?.quality);
                  const iconPath =
                    safeString(rec?.iconPath) || safeString(rec?.tipsPath);

                  const getway = Array.isArray(rec?.Getway) ? rec.Getway : [];
                  const getwayPreview = getway
                    .slice(0, 2)
                    .map((g: any) =>
                      getTranslatedString(safeString(g?.DisplayName) || "")
                    )
                    .filter((s: string) => s.trim() !== "");

                  return (
                    <div key={it.id} className="flex flex-col gap-1 relative">
                      <div
                        className={[
                          "w-full aspect-square rounded-lg overflow-hidden neon-border relative flex items-center justify-center",
                          getQualityBgColor(quality),
                        ].join(" ")}
                      >
                        {iconPath ? (
                          <img
                            src={iconPath || "/placeholder.svg"}
                            alt={name}
                            className="w-full h-full object-contain p-1"
                            onError={(ev) => {
                              ev.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-xs text-center">
                            {name.substring(0, 2)}
                          </span>
                        )}

                        <button
                          className="absolute top-1 right-1 bg-black bg-opacity-60 rounded-full p-1 flex items-center justify-center z-10"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setShowItemDetailsId(it.id);
                          }}
                        >
                          <Info className="w-6 h-6 text-white" />
                        </button>
                      </div>

                      <div className="text-xs font-medium truncate neon-text">
                        {name}
                      </div>

                      {getwayPreview.length > 0 ? (
                        <div className="text-[11px] text-gray-400 leading-4">
                          {getwayPreview.join(" / ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "train" && (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {filteredHomeWeapons.length === 0 ? (
                <div className="col-span-full text-center py-6 text-gray-400">
                  {getTranslatedString("encyclopedia.empty") || "결과 없음"}
                </div>
              ) : (
                filteredHomeWeapons.map((r) => {
                  const nameKey =
                    safeString(r?.nameTok) ||
                    safeString(r?.name) ||
                    safeString(r?.id);
                  const name = getTranslatedString(nameKey);

                  const quality = safeString(r?.quality);
                  const img =
                    safeString(r?.imagePath) || safeString(r?.tipsPath);

                  const weaponType =
                    safeString(r?.mod) ||
                    safeString(r?.weaponType) ||
                    safeString(r?.typeWeapon);
                  const powerLoad =
                    r?.powerCost ??
                    r?.energyCost ??
                    r?.costPower ??
                    r?.power ??
                    null;
                  const coreList = Array.isArray(r?.coreList) ? r.coreList : [];

                  return (
                    <div
                      key={String(r?.id)}
                      className="flex flex-col gap-1 relative"
                    >
                      <div
                        className={[
                          "w-full aspect-[4/3] rounded-lg overflow-hidden neon-border relative flex items-center justify-center",
                          getQualityBgColor(quality),
                        ].join(" ")}
                      >
                        {img ? (
                          <img
                            src={img || "/placeholder.svg"}
                            alt={name}
                            className="w-full h-full object-contain p-1"
                            onError={(ev) => {
                              ev.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-xs text-center">
                            {name.substring(0, 2)}
                          </span>
                        )}

                        <button
                          className="absolute top-1 right-1 bg-black bg-opacity-60 rounded-full p-1 flex items-center justify-center z-10"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setShowTrainDetailsId(String(r?.id));
                          }}
                        >
                          <Info className="w-6 h-6 text-white" />
                        </button>
                      </div>

                      <div className="text-xs font-medium truncate neon-text">
                        {name}
                      </div>

                      <div className="text-[11px] text-gray-400 leading-4">
                        {weaponType ? weaponType : "type: -"}
                        {powerLoad !== null
                          ? ` · 부하 ${String(powerLoad)}`
                          : ""}
                      </div>

                      <div className="text-[11px] text-gray-400 leading-4">
                        코어 조건 {coreList.length > 0 ? coreList.length : 0}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500">
            상세에서 값이 비어 있으면 build_db.mjs가 해당 factory의 어떤
            필드까지 싣는지/필드명이 무엇인지 확인해야 함.
          </div>
        </div>
      </Modal>

      {showEquipDetailsId && selectedEquip ? (
        <EquipmentDetailsModal
          isOpen={!!showEquipDetailsId}
          onClose={() => setShowEquipDetailsId(null)}
          equipment={selectedEquip as any}
          getSkill={getSkill}
          getTranslatedString={getTranslatedString}
          commodityDb={(data as any)?.commodityDb}
          sourceMaterialDb={data?.sourceMaterialDb}
        />
      ) : null}

      {showItemDetailsId && selectedItem ? (
        <ItemDetailsModal
          isOpen={!!showItemDetailsId}
          onClose={() => setShowItemDetailsId(null)}
          itemId={String(showItemDetailsId)}
          itemEntry={selectedItem}
          data={data}
          getTranslatedString={getTranslatedString}
        />
      ) : null}

      {showTrainDetailsId && selectedTrain ? (
        <TrainWeaponDetailsModal
          isOpen={!!showTrainDetailsId}
          onClose={() => setShowTrainDetailsId(null)}
          weaponId={String(showTrainDetailsId)}
          weaponEntry={selectedTrain}
          data={data}
          getTranslatedString={getTranslatedString}
        />
      ) : null}
    </>
  );
}
