"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, FolderOpen, X } from "lucide-react";
import { Modal } from "./Modal";

import type { Database } from "../../types/index";
import { decodePresetFromUrlParam } from "../../utils/presetCodec";

export type DeckListFileItem = {
  name: string;
  shareUrl: string;
  link?: string;
};

export interface DeckListModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks?: DeckListFileItem[];
  data: Database;
  getTranslatedString?: (key: string) => string;
  fetchUrl?: string;
  onApplyPreset?: (shareUrl: string) => void;
  onCopiedPresetCode?: () => void;
}

function safeTr(tr: ((key: string) => string) | undefined, s: string) {
  if (!tr) return s;
  try {
    const r = tr(s);
    return r ?? s;
  } catch {
    return s;
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function extractCodeFromMaybeUrl(input: string) {
  const s = (input || "").trim();
  if (!s) return "";

  try {
    const u = new URL(s);
    const code = u.searchParams.get("code");
    if (code && code.trim()) return code.trim();
  } catch {}

  try {
    const params = new URLSearchParams(s.startsWith("?") ? s.slice(1) : s);
    const code = params.get("code");
    if (code && code.trim()) return code.trim();
  } catch {}

  return s;
}

// v2: include/exclude
const CHAR_FILTER_STORAGE_KEY_V2 = "deck_list_modal_char_filter_v2";

type CharFilterV2 = {
  include: number[];
  exclude: number[];
};

function loadFilterV2FromStorage(): CharFilterV2 | null {
  try {
    const raw = localStorage.getItem(CHAR_FILTER_STORAGE_KEY_V2);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    const include = Array.isArray(obj?.include) ? obj.include : [];
    const exclude = Array.isArray(obj?.exclude) ? obj.exclude : [];

    return {
      include: include
        .map((v: any) => Number(v))
        .filter((n: any) => Number.isFinite(n) && n > 0),
      exclude: exclude
        .map((v: any) => Number(v))
        .filter((n: any) => Number.isFinite(n) && n > 0),
    };
  } catch {
    return null;
  }
}

function saveFilterV2ToStorage(
  includeIds: Set<number>,
  excludeIds: Set<number>
) {
  try {
    const obj: CharFilterV2 = {
      include: Array.from(includeIds.values()),
      exclude: Array.from(excludeIds.values()),
    };
    localStorage.setItem(CHAR_FILTER_STORAGE_KEY_V2, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

export function DeckListModal({
  isOpen,
  onClose,
  decks,
  data,
  getTranslatedString,
  onApplyPreset,
  onCopiedPresetCode,
  // fetchUrl = "/db/deck_list.json",
  fetchUrl = "https://rueceline.github.io/deck-list-data/deck_list.json",
}: DeckListModalProps) {
  const [fetchedDecks, setFetchedDecks] = useState<DeckListFileItem[] | null>(
    null
  );
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [includeIds, setIncludeIds] = useState<Set<number>>(() => new Set());
  const [excludeIds, setExcludeIds] = useState<Set<number>>(() => new Set());

  const [editMode, setEditMode] = useState<"include" | "exclude" | null>(null);
  const [charSearch, setCharSearch] = useState<string>("");

  // decks prop이 없을 때만 fetch 시도
  useEffect(() => {
    if (!isOpen) return;

    if (decks && decks.length > 0) {
      setFetchedDecks(null);
      setFetchError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setFetchError(null);
        const res = await fetch(fetchUrl, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
        }
        const json = (await res.json()) as DeckListFileItem[];
        if (!Array.isArray(json)) {
          throw new Error("invalid json: expected array");
        }
        if (!cancelled) setFetchedDecks(json);
      } catch (e: any) {
        if (!cancelled) setFetchError(String(e?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, decks, fetchUrl]);

  // 수동 저장/불러오기: 모달 오픈 시 기본은 "전체 표시"(include/exclude 비움)
  useEffect(() => {
    if (!isOpen) return;

    setIncludeIds(new Set());
    setExcludeIds(new Set());
    setEditMode(null);
    setCharSearch("");
  }, [isOpen]);

  const list = useMemo(() => {
    if (decks && decks.length > 0) return decks;
    if (fetchedDecks && fetchedDecks.length > 0) return fetchedDecks;
    return [];
  }, [decks, fetchedDecks]);

  const allCharacterIds = useMemo(() => {
    const chars: Record<string, any> = (data as any)?.characters || {};

    const rarityRank: Record<string, number> = {
      UR: 4,
      SSR: 3,
      SR: 2,
      R: 1,
    };

    return Object.keys(chars)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => {
        const ra =
          rarityRank[String(chars[String(a)]?.rarity ?? "").toUpperCase()] ?? 0;
        const rb =
          rarityRank[String(chars[String(b)]?.rarity ?? "").toUpperCase()] ?? 0;

        if (ra !== rb) return rb - ra;
        return a - b;
      });
  }, [data]);

  const getChar = (id: number) => {
    if (!data?.characters) return null;
    const rec = (data.characters as any)[String(id)];
    return rec ?? null;
  };

  const getCharImg = (id: number) => {
    const c = getChar(id);
    const url = c?.face;
    if (isNonEmptyString(url)) return url;
    return "/images/placeHolder_Card.jpg";
  };

  const getCharName = (id: number) => {
    const c = getChar(id);
    const raw = isNonEmptyString(c?.name) ? c.name : "";
    return safeTr(getTranslatedString, raw);
  };

  function removeFromInclude(id: number) {
    setIncludeIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function removeFromExclude(id: number) {
    setExcludeIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // "초기화" = 화면만 처음 상태로(저장/불러오기와 분리)
  function resetFiltersUIOnly() {
    setIncludeIds(new Set());
    setExcludeIds(new Set());
  }

  function saveFiltersToStorage() {
    saveFilterV2ToStorage(includeIds, excludeIds);
  }

  // 불러오기는 v2 우선, 없으면 v1 마이그레이션(저장은 사용자가 눌렀을 때만)
  function loadFiltersFromStorage() {
    const v2 = loadFilterV2FromStorage();
    if (v2) {
      const inc = new Set<number>(v2.include);
      const exc = new Set<number>(v2.exclude);

      // 겹치면 include 우선
      for (const id of inc) {
        if (exc.has(id)) exc.delete(id);
      }

      setIncludeIds(inc);
      setExcludeIds(exc);
      return;
    }

    // 없으면 초기 상태
    setIncludeIds(new Set());
    setExcludeIds(new Set());
  }

  // 포함/제외 클릭: 한 번에 set 해서 batching 이슈 줄임
  function toggleEditPick(id: number) {
    if (editMode === "include") {
      const nextInclude = new Set(includeIds);
      if (nextInclude.has(id)) nextInclude.delete(id);
      else nextInclude.add(id);

      const nextExclude = new Set(excludeIds);
      if (nextExclude.has(id)) nextExclude.delete(id);

      setIncludeIds(nextInclude);
      setExcludeIds(nextExclude);
      return;
    }

    if (editMode === "exclude") {
      const nextExclude = new Set(excludeIds);
      if (nextExclude.has(id)) nextExclude.delete(id);
      else nextExclude.add(id);

      const nextInclude = new Set(includeIds);
      if (nextInclude.has(id)) nextInclude.delete(id);

      setIncludeIds(nextInclude);
      setExcludeIds(nextExclude);
      return;
    }
  }

  // 모달 footer: 현재 모드만 해제(저장 안 함)
  function clearCurrentModeSelectionUIOnly() {
    if (editMode === "include") {
      setIncludeIds(new Set());
      return;
    }

    if (editMode === "exclude") {
      setExcludeIds(new Set());
      return;
    }
  }

  const parsedDecks = useMemo(() => {
    return list.map((d, idx) => {
      const name = safeTr(getTranslatedString, d.name);
      const code = extractCodeFromMaybeUrl(d.shareUrl).replace(/ /g, "+");

      let ids: number[] = [];
      try {
        const preset: any = decodePresetFromUrlParam(code);
        const arr = preset?.roleList ?? null;

        if (Array.isArray(arr)) {
          ids = arr
            .map((v: any) => Number(v))
            .filter((n: any) => Number.isFinite(n) && n > 0);
        }

        const leaderId = Number(preset?.header);
        if (Number.isFinite(leaderId) && leaderId > 0) {
          ids = [leaderId, ...ids.filter((x) => x !== leaderId)];
        }
      } catch {
        ids = [];
      }

      return { key: `${d.name}-${idx}`, raw: d, name, code, ids };
    });
  }, [list, getTranslatedString]);

  const filteredDecks = useMemo(() => {
    if (parsedDecks.length === 0) return [];

    const inc = includeIds;
    const exc = excludeIds;

    return parsedDecks
      .filter((d) => {
        for (const cid of d.ids) {
          if (exc.has(cid)) return false;
        }

        if (inc.size === 0) return true;

        for (const cid of d.ids) {
          if (inc.has(cid)) return true;
        }
        return false;
      })
      .slice()      // 원본 배열 보호
      .reverse();
  }, [parsedDecks, includeIds, excludeIds]);

  const visibleCharacterIdsInEditor = useMemo(() => {
    const q = charSearch.trim().toLowerCase();
    if (!q) return allCharacterIds;

    return allCharacterIds.filter((cid) => {
      const name = getCharName(cid).toLowerCase();
      return name.includes(q) || String(cid).includes(q);
    });
  }, [allCharacterIds, charSearch]);

  const title = (
    <div className="text-base font-semibold text-white">
      {safeTr(getTranslatedString, "deck_list_modal.title")}
    </div>
  );

  const footer = (
    <div className="flex justify-end p-3">
      <button
        type="button"
        className="rounded-md border border-white/10 px-5 py-2.5 text-sm text-white hover:opacity-80"
        onClick={onClose}
      >
        {safeTr(getTranslatedString, "close")}
      </button>
    </div>
  );

  function Chip({ id, mode }: { id: number; mode: "include" | "exclude" }) {
    const onRemove = mode === "include" ? removeFromInclude : removeFromExclude;

    return (
      <div className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-white">
        <img
          src={getCharImg(id)}
          alt={getCharName(id)}
          className="h-8 w-8 rounded object-cover"
        />
        <div className="max-w-[140px] truncate">{getCharName(id)}</div>
        <button
          type="button"
          className="ml-1 inline-flex items-center justify-center rounded hover:bg-white/10"
          onClick={() => onRemove(id)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => onClose()}
        title={title}
        closeOnOutsideClick={true}
        maxWidth="max-w-5xl"
        footer={footer}
      >
        <div className="p-4">
          {fetchError && (
            <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {safeTr(getTranslatedString, "deck_list_modal.fetch_failed")} (
              {fetchError})
            </div>
          )}

          {list.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {safeTr(getTranslatedString, "deck_list_modal.empty")}
            </div>
          ) : (
            <div>
              <div className="mb-4 rounded-md border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-white">
                    {safeTr(getTranslatedString, "deck_list_modal.character_filter")}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-xs text-white hover:bg-white/5"
                      onClick={() => {
                        setCharSearch("");
                        setEditMode("include");
                      }}                      
                    >
                      {safeTr(getTranslatedString, "deck_list_modal.add")}
                    </button>

                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-xs text-white hover:bg-white/5"
                      onClick={() => {
                        setCharSearch("");
                        setEditMode("exclude");
                      }}                      
                    >
                      {safeTr(getTranslatedString, "deck_list_modal.exclude_label")}
                    </button>

                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-xs text-white hover:bg-white/5"
                      onClick={resetFiltersUIOnly}                      
                    >
                      {safeTr(getTranslatedString, "button.clear")}
                    </button>

                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-xs text-white hover:bg-white/5"
                      onClick={saveFiltersToStorage}
                    >
                      {safeTr(getTranslatedString, "save_deck")}
                    </button>

                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-xs text-white hover:bg-white/5"
                      onClick={loadFiltersFromStorage}
                    >
                      {safeTr(getTranslatedString, "load_deck")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-stretch gap-2">
                    <div className="w-[52px] shrink-0 text-xs text-muted-foreground flex items-center">
                      {safeTr(getTranslatedString, "deck_list_modal.include_label")}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {includeIds.size === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {safeTr(getTranslatedString, "none")}
                        </div>
                      ) : (
                        Array.from(includeIds.values()).map((id) => (
                          <Chip key={`inc-${id}`} id={id} mode="include" />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-stretch gap-2">
                    <div className="w-[52px] shrink-0 text-xs text-muted-foreground flex items-center">
                      {safeTr(getTranslatedString, "deck_list_modal.exclude_label")}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {excludeIds.size === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {safeTr(getTranslatedString, "none")}
                        </div>
                      ) : (
                        Array.from(excludeIds.values()).map((id) => (
                          <Chip key={`exc-${id}`} id={id} mode="exclude" />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {safeTr(getTranslatedString, "deck_list_modal.visible_decks")}{" "}
                  {filteredDecks.length}/{parsedDecks.length}
                </div>
              </div>

              {/* 모바일: 카드형(세로) */}
              <div className="sm:hidden space-y-3">
                {filteredDecks.map((d) => {
                  const ids = d.ids;

                  return (
                    <div
                      key={d.key}
                      className="rounded-md border border-white/10 bg-white/5 p-3"
                    >
                      {/* 1) 이름 */}
                      <div className="text-white font-medium break-words whitespace-normal">
                        {d.name}
                      </div>

                      {/* 2) 섬네일 (줄바꿈/축소 금지) */}
                      <div className="mt-3 flex justify-center gap-1 flex-nowrap">
                        {ids.length === 0 ? (
                          <div className="text-xs text-muted-foreground">-</div>
                        ) : (
                          ids.map((cid, j) => {
                            if (
                              cid === -1 ||
                              cid === undefined ||
                              cid === null
                            ) {
                              return (
                                <div
                                  key={`m-empty-${j}`}
                                  className="h-10 w-10 shrink-0 rounded-md border border-white/10 bg-white/5"
                                  title="-"
                                />
                              );
                            }

                            return (
                              <img
                                key={`m-${cid}-${j}`}
                                src={getCharImg(cid)}
                                alt={getCharName(cid)}
                                title={getCharName(cid)}
                                className="h-16 w-16 shrink-0 rounded-md border border-white/10 object-cover"
                              />
                            );
                          })
                        )}
                      </div>

                      {/* 3) 버튼 (줄바꿈 허용) */}
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                          onClick={() => {
                            const code = d.code;
                            if (!isNonEmptyString(code)) return;

                            if (onApplyPreset) {
                              onApplyPreset(code);
                              onClose();
                            }
                          }}
                        >
                          <FolderOpen className="h-5 w-5" />
                          {safeTr(getTranslatedString, "Open")}
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                          onClick={async () => {
                            const code = d.code;
                            if (!isNonEmptyString(code)) return;

                            try {
                              await copyToClipboard(code);
                              if (onCopiedPresetCode) onCopiedPresetCode();
                            } catch (error) {
                              console.error("Copy preset error:", error);
                            }
                          }}
                        >
                          <Copy className="h-5 w-5" />
                          {safeTr(getTranslatedString, "Copy")}
                        </button>

                        {isNonEmptyString(d.raw.link) ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                            onClick={() => {
                              window.open(
                                d.raw.link!,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }}
                          >
                            <Link2 className="h-5 w-5" />
                            {safeTr(getTranslatedString, "Link")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="py-2 pr-3 text-center font-medium">
                        {safeTr(getTranslatedString, "deck_list_modal.party_name")}
                      </th>

                      <th className="py-2 pr-3 text-center font-medium w-[400px]">
                        {safeTr(getTranslatedString, "deck_list_modal.characters")}
                      </th>

                      <th className="py-2 pr-3 text-center font-medium w-[300px]">
                        {safeTr(getTranslatedString, "deck_list_modal.actions")}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredDecks.map((d) => {
                      const ids = d.ids;

                      return (
                        <tr
                          key={d.key}
                          className="border-b border-white/10 text-center"
                        >
                          <td className="py-3 pr-3 align-middle">
                            <div className="text-white">{d.name}</div>
                          </td>

                          <td className="py-3 px-3 align-middle text-center w-[400px]">
                            <div className="flex justify-center gap-1 flex-wrap">
                              {ids.length === 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  -
                                </div>
                              ) : (
                                ids.map((cid, j) => {
                                  if (
                                    cid === -1 ||
                                    cid === undefined ||
                                    cid === null
                                  ) {
                                    return (
                                      <div
                                        key={`empty-${j}`}
                                        className="h-10 w-10 rounded-md border border-white/10 bg-white/5"
                                        title="-"
                                      />
                                    );
                                  }

                                  return (
                                    <img
                                      key={`${cid}-${j}`}
                                      src={getCharImg(cid)}
                                      alt={getCharName(cid)}
                                      title={getCharName(cid)}
                                      className="h-16 w-16 rounded-md border border-white/10 object-cover"
                                    />
                                  );
                                })
                              )}
                            </div>
                          </td>

                          <td className="py-3 pr-3 align-middle w-[300px]">
                            <div className="flex items-center gap-2 justify-center flex-nowrap">
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                                onClick={() => {
                                  const code = d.code;
                                  if (!isNonEmptyString(code)) return;

                                  if (onApplyPreset) {
                                    onApplyPreset(code);
                                    onClose();
                                  }
                                }}
                              >
                                <FolderOpen className="h-5 w-5" />
                                {safeTr(getTranslatedString, "Open")}
                              </button>

                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                                onClick={async () => {
                                  const code = d.code;
                                  if (!isNonEmptyString(code)) return;

                                  try {
                                    await copyToClipboard(code);
                                    if (onCopiedPresetCode)
                                      onCopiedPresetCode();
                                  } catch (error) {
                                    console.error("Copy preset error:", error);
                                  }
                                }}
                              >
                                <Copy className="h-5 w-5" />
                                {safeTr(getTranslatedString, "Copy")}
                              </button>

                              {isNonEmptyString(d.raw.link) ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                                  onClick={() => {
                                    window.open(
                                      d.raw.link!,
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }}
                                >
                                  <Link2 className="h-5 w-5" />
                                  {safeTr(getTranslatedString, "Link")}
                                </button>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  -
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={editMode !== null}
        onClose={() => setEditMode(null)}
        title={
          <div className="text-base font-semibold text-white">
            {editMode === "include"
              ? safeTr(getTranslatedString, "deck_list_modal.select_include_characters")
              : safeTr(getTranslatedString, "deck_list_modal.select_exclude_characters")}
          </div>
        }
        closeOnOutsideClick={true}
        maxWidth="max-w-5xl"
        footer={
          <div className="flex justify-between p-3">
            <div className="text-xs text-muted-foreground">
              {editMode === "include"
                ? `${safeTr(getTranslatedString, "deck_list_modal.selected")}: ${includeIds.size}`
                : `${safeTr(getTranslatedString, "deck_list_modal.selected")}: ${excludeIds.size}`}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/5"
                onClick={clearCurrentModeSelectionUIOnly}                
              >
                {safeTr(getTranslatedString, "deck_list_modal.clear_all")}
              </button>

              <button
                type="button"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm text-white hover:opacity-80"
                onClick={() => setEditMode(null)}
              >
                {safeTr(getTranslatedString, "close")}
              </button>
            </div>
          </div>
        }
      >
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <input
              value={charSearch}
              onChange={(e) => setCharSearch(e.target.value)}
              placeholder={safeTr(getTranslatedString, "search")}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
            />
          </div>

          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 md:grid-cols-12">
            {visibleCharacterIdsInEditor.map((cid) => {
              const inInclude = includeIds.has(cid);
              const inExclude = excludeIds.has(cid);
              const active =
                editMode === "include"
                  ? inInclude
                  : editMode === "exclude"
                  ? inExclude
                  : false;

              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => toggleEditPick(cid)}
                  className={[
                    "rounded-md border p-1 flex items-center justify-center",
                    active
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 bg-transparent opacity-40",
                    editMode === "include" && inExclude
                      ? "ring-1 ring-red-500/40"
                      : "",
                    editMode === "exclude" && inInclude
                      ? "ring-1 ring-yellow-500/40"
                      : "",
                    "hover:opacity-100",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={getCharName(cid)}
                >
                  <img
                    src={getCharImg(cid)}
                    alt={getCharName(cid)}
                    className="h-20 w-20 rounded-md object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}
