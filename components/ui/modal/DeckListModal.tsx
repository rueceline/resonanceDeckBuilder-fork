"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, FolderOpen } from "lucide-react";
import { Modal } from "./Modal";

// 프로젝트 타입 경로는 환경마다 다를 수 있어서 일단 이렇게 둠.
// deckBuilder.tsx에서 Database를 "../types/index"에서 가져오고 있으니 동일하게 맞추는 게 안전함.
// 필요하면 경로만 바꿔주세요.
import type { Database } from "../../../types/index";
import { decodePresetFromUrlParam } from "../../../utils/presetCodec";

export type DeckListFileItem = {
  name: string;

  // 여기에는 2가지가 모두 들어올 수 있게:
  // 1) code만: "tVfLbtswEPyX..."
  // 2) URL/쿼리: "http://.../ko?code=...." 또는 "code=...."
  shareUrl: string;
  link?: string;
};

// (A) src 내 TS/JSON 파일 import 방식 쓰고 싶으면 아래처럼 파일 만들어서 import 하세요.
// 예: src/app/deckbuilder_nextless/data/deck-list.ts
// export const deckList: DeckListFileItem[] = [...];
// import { deckList as importedDeckList } from "../../data/deck-list";

// (B) public 아래 JSON fetch 방식 쓰고 싶으면 아래 경로로 JSON 두세요.
// 예: public/deck_list.json  ->  "/deck_list.json" 로 fetch

export interface DeckListModalProps {
  isOpen: boolean;
  onClose: () => void;

  // 덱 목록을 외부에서 주입해도 되고(추천), 안 주면 fetch로 시도함.
  // 파일로 관리한다는 조건은 "import 주입" 또는 "public fetch" 둘 다 충족.
  decks?: DeckListFileItem[];

  // 캐릭터 이미지/이름 매핑용
  data: Database;

  // 번역 함수는 기존 모달들이 받는 패턴이 있어서 옵션으로 넣어둠
  // (덱 이름을 번역키로 관리할지, 원문 그대로 쓸지 몰라서)
  getTranslatedString?: (key: string) => string;

  // (B) fetch 방식 쓸 때 JSON 경로
  fetchUrl?: string; // 기본 "/deck_list.json"
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

  // 1) URL 전체
  try {
    const u = new URL(s);
    const code = u.searchParams.get("code");
    if (code && code.trim()) return code.trim();
  } catch {}

  // 2) "code=..." 조각
  try {
    const params = new URLSearchParams(s.startsWith("?") ? s.slice(1) : s);
    const code = params.get("code");
    if (code && code.trim()) return code.trim();
  } catch {}

  // 3) 그냥 code 단독
  return s;
}

export function DeckListModal({
  isOpen,
  onClose,
  decks,
  data,
  getTranslatedString,
  onApplyPreset,
  onCopiedPresetCode,
  fetchUrl = "/api/db/deck_list.json",
}: DeckListModalProps) {
  const [fetchedDecks, setFetchedDecks] = useState<DeckListFileItem[] | null>(
    null
  );
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  const list = useMemo(() => {
    if (decks && decks.length > 0) return decks;
    if (fetchedDecks && fetchedDecks.length > 0) return fetchedDecks;
    return [];
  }, [decks, fetchedDecks]);

  const getChar = (id: number) => {
    if (!data?.characters) return null;
    const rec = (data.characters as any)[String(id)];
    return rec ?? null;
  };

  const getCharImg = (id: number) => {
    const c = getChar(id);
    // 프로젝트에서 캐릭터 카드 이미지로 img_card 쓰는 흔적이 있음 :contentReference[oaicite:1]{index=1}
    const url = c?.img_card;
    if (isNonEmptyString(url)) return url;
    return "/images/placeHolder_Card.jpg";
  };

  const getCharName = (id: number) => {
    const c = getChar(id);
    const raw = isNonEmptyString(c?.name) ? c.name : "";
    return safeTr(getTranslatedString, raw);
  };

  const title = (
    <div className="text-base font-semibold text-white">
      {safeTr(getTranslatedString, "저장된 덱 목록")}
    </div>
  );

  const footer = (
    <div className="flex justify-end p-3">
      <button
        type="button"
        className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white hover:opacity-80"
        onClick={onClose}
      >
        {safeTr(getTranslatedString, "닫기")}
      </button>
    </div>
  );

  return (
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
            {safeTr(getTranslatedString, "덱 목록을 불러오지 못했습니다.")} (
            {fetchError})
          </div>
        )}

        {list.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {safeTr(getTranslatedString, "저장된 덱이 없습니다.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium w-[280px]">
                    {safeTr(getTranslatedString, "덱 이름")}
                  </th>

                  <th className="py-2 pr-3 text-left font-medium">
                    {safeTr(getTranslatedString, "캐릭터")}
                  </th>

                  <th className="py-2 pr-3 text-left font-medium w-[220px]">
                    {safeTr(getTranslatedString, "동작")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {list.map((d, idx) => {
                  const name = safeTr(getTranslatedString, d.name);
                  const code = extractCodeFromMaybeUrl(d.shareUrl).replace(
                    / /g,
                    "+"
                  );

                  let ids: number[] = [];
                  try {
                    const preset: any = decodePresetFromUrlParam(code);

                    // 프로젝트마다 키가 다를 수 있어서 후보를 넓게 잡음
                    const arr =
                      preset?.selectedCharacters ??
                      preset?.characters ??
                      preset?.characterIds ??
                      preset?.chars ??
                      null;

                    if (Array.isArray(arr)) {
                      ids = arr
                        .map((v: any) => Number(v))
                        .filter((n: any) => Number.isFinite(n) && n > 0);
                    }

                    // 리더가 따로 있으면 맨 앞에 배치(원하면 유지)
                    const leader =
                      preset?.leaderCharacter ??
                      preset?.leader ??
                      preset?.leaderId ??
                      null;

                    const leaderId = Number(leader);
                    if (Number.isFinite(leaderId) && leaderId > 0) {
                      ids = [leaderId, ...ids.filter((x) => x !== leaderId)];
                    }
                  } catch {
                    ids = [];
                  }

                  return (
                    <tr
                      key={`${d.name}-${idx}`}
                      className="border-b border-white/10"
                    >
                      {/* 덱 이름 */}
                      <td className="py-3 pr-3 align-middle">
                        <div className="text-white">{name}</div>
                      </td>

                      {/* 캐릭터 (리더/멤버 구분 없이 전부 나열) */}
                      <td className="py-3 pr-3 align-middle">
                        <div className="flex items-center gap-2">
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
                                    className="h-12 w-12 rounded-md border border-white/10 bg-white/5"
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
                                  className="h-12 w-12 rounded-md border border-white/10 object-cover"
                                />
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* 동작 */}
                      <td className="py-3 pr-3 align-middle">
                        <div className="flex items-center gap-2">
                          {/* Open: 덱빌더에 붙여넣기 적용 */}
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                            onClick={() => {
                              const code = extractCodeFromMaybeUrl(
                                d.shareUrl
                              ).replace(/ /g, "+");

                              console.log(code);

                              if (!isNonEmptyString(code)) return;

                              if (onApplyPreset) {
                                onApplyPreset(code);

                                // Open 후 모달 닫기
                                onClose();
                              }
                            }}
                            title={safeTr(getTranslatedString, "덱 적용(Open)")}
                          >
                            <FolderOpen className="h-5 w-5" />
                            {safeTr(getTranslatedString, "Open")}
                          </button>

                          {/* Copy: 코드 복사 */}
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                            onClick={async () => {
                              const code = extractCodeFromMaybeUrl(
                                d.shareUrl
                              ).replace(/ /g, "+");
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

                          {/* Link: 원본 웹 페이지 링크 */}
                          {isNonEmptyString(d.link) ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
                              onClick={() => {
                                window.open(
                                  d.link!,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              }}
                              title={safeTr(
                                getTranslatedString,
                                "원본 링크 열기"
                              )}
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

            <div className="mt-3 text-xs text-muted-foreground">
              {safeTr(
                getTranslatedString,
                "Copy는 덱 프리셋 코드를 클립보드에 복사합니다."
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
