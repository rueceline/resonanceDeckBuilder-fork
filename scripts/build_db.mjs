// build_db_extracted.js
// 목적:
// - 최신 Factory.json(예: public/data/CN/*Factory.json)에서 DeckBuilder용 *_db.json + lang_cn/ko.json + maps 생성
// - "구버전 db를 스크립트에 포함"하지 않음(업데이트 가능)
// - 포함/제외 조건은 Factory만으로 검증 가능해야 함
//   => BookFactory의 도감 목록을 "실제 획득/표시 대상"의 1차 기준으로 사용(가설 검증/리포트 포함)
//
// 실행(Windows/WSL 동일):
// node scripts/build_db_extracted.js
//
// 입력 폴더(압축 해제 가정):
//   public/data/CN/*.json
//   public/data/KR/ConfigLanguage.json
//
// 출력 폴더:
//   public/data/*.json (char_db, equip_db, ... lang_*.json, map들)
//
// 주의:
// - ConfigLanguage 매칭은 "CN 원문 -> KO" 문자열 매칭을 보수적으로 구현함.
//   (원본 lib.js의 정교한 규칙이 따로 있다면 이 파일의 tr()/loadConfigLanguage()만 교체하면 됨.)

import fs from "fs";
import path from "path";

// -------------------- CONFIG --------------------
const ROOT = process.cwd();

const CN_DIR = path.join(ROOT, "public", "data", "CN");
const KR_DIR = path.join(ROOT, "public", "data", "KR");
const CONFIG_LANG_PATH = path.join(KR_DIR, "ConfigLanguage.json");

const OUT_DIR = path.join(ROOT, "public", "db");

// 기존 lang 파일(UI 텍스트 등) 유지 + 신규 토큰만 추가
const MERGE_EXISTING_LANG = true;

// BookFactory 기반 포함 규칙(가설):
// - Unit: BookFactory.idCN === "角色图鉴" 의 unitList
// - Equip: BookFactory.idCN === "角色装备图鉴" 의 equipmentList
const BOOK_UNIT_IDCN = "角色图鉴";
const BOOK_EQUIP_IDCN = "角色装备图鉴";

// 검증 리포트 출력 여부
const WRITE_REPORTS = false;

// -------------------- FILE UTILS (lib.js 포함분) --------------------
function ensureDirForFile(absPath) {
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readText(absPath) {
  return fs.readFileSync(absPath, "utf-8");
}

function readJson(absPath) {
  return JSON.parse(readText(absPath));
}

function writeJson(absPath, obj) {
  ensureDirForFile(absPath);
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2), "utf-8");
}

function readJsonIfExists(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    return readJson(absPath);
  } catch {
    return null;
  }
}

function normalizeRootJson(root) {
  // data가 {data:[...]} 형태인 경우 대비
  if (Array.isArray(root)) return root;
  if (root && typeof root === "object") {
    if (Array.isArray(root.data)) return root.data;
  }
  return [];
}

function safeNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function buildIdMap(list) {
  const m = new Map();
  for (const r of Array.isArray(list) ? list : []) {
    const id = safeNumber(r?.id);
    if (id !== null) m.set(id, r);
  }
  return m;
}

// -------------------- ConfigLanguage / tr (lib.js 포함분) --------------------
// 요구사항:
// - ConfigLanguage.json은 원본 팩토리명/필드명과 1:1로 매칭되는 중첩 dict 형태를 사용한다.
//   cfg[FactoryName][FieldName][CN_TEXT] = KO_TEXT
// - 매칭 실패 시 원문(CN) 그대로 유지한다.
// - CRLF/LF 차이로 인해 매칭이 깨지는 경우를 대비해, (CN 키 / KO 값) 모두 개행을 정규화한 변형 키를 추가한다.

function normText(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function loadConfigLanguage(cfgAbsPath) {
  const cfg = readJson(cfgAbsPath) || {};

  // Add normalized-key variants (CRLF -> LF) for safer 1:1 matching.
  for (const factoryName of Object.keys(cfg)) {
    const facObj = cfg[factoryName];
    if (!facObj || typeof facObj !== "object" || Array.isArray(facObj))
      continue;

    for (const fieldName of Object.keys(facObj)) {
      const mapping = facObj[fieldName];
      if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
        continue;

      const add = {};
      for (const [zh, ko] of Object.entries(mapping)) {
        if (typeof zh !== "string" || typeof ko !== "string" || ko === "")
          continue;

        const nzh = normText(zh);
        const nko = normText(ko);

        if (nzh !== zh && !Object.prototype.hasOwnProperty.call(mapping, nzh)) {
          add[nzh] = nko;
        }
      }

      for (const [k, v] of Object.entries(add)) {
        mapping[k] = v;
      }
    }
  }

  return cfg;
}

function tr(cfg, factoryName, fieldName, textCN) {
  if (textCN === null || textCN === undefined) return "";
  const src = String(textCN);

  const facObj = cfg ? cfg[factoryName] : null;
  if (!facObj || typeof facObj !== "object") {
    return src;
  }

  const mapping = facObj[fieldName];
  if (!mapping || typeof mapping !== "object") {
    return src;
  }

  if (Object.prototype.hasOwnProperty.call(mapping, src)) {
    return mapping[src];
  }

  const n = normText(src);
  if (Object.prototype.hasOwnProperty.call(mapping, n)) {
    return mapping[n];
  }

  return src; // 누락은 미번역이므로 그대로
}

// -------------------- Load Factories --------------------
function loadFactoryList(factoryFileName) {
  const abs = path.join(CN_DIR, factoryFileName);
  const raw = readJson(abs);
  return normalizeRootJson(raw);
}

// -------------------- BookFactory 기반 포함 세트 --------------------
function getBookListByIdCN(bookFactory, idcn) {
  for (const rec of Array.isArray(bookFactory) ? bookFactory : []) {
    if (String(rec?.idCN ?? "") === idcn) return rec;
  }
  return null;
}

function buildIncludedIdSetsFromBook(bookFactory) {
  const unitBook = getBookListByIdCN(bookFactory, BOOK_UNIT_IDCN);
  const equipBook = getBookListByIdCN(bookFactory, BOOK_EQUIP_IDCN);

  const unitIds = new Set();
  const equipIds = new Set();

  const unitList = Array.isArray(unitBook?.unitList) ? unitBook.unitList : [];
  for (const u of unitList) {
    const id = safeNumber(u?.id);
    if (id !== null) unitIds.add(id);
  }

  const equipmentList = Array.isArray(equipBook?.equipmentList)
    ? equipBook.equipmentList
    : [];
  for (const e of equipmentList) {
    const id = safeNumber(e?.id);
    if (id !== null) equipIds.add(id);
  }

  return {
    unitIds,
    equipIds,
    unitBookId: unitBook?.id ?? null,
    equipBookId: equipBook?.id ?? null,
  };
}

// -------------------- Tokenizer + Lang Collector --------------------
function makeLangCollector(cfgMap) {
  // token -> { cn, ko, factoryName, fieldName }
  const dict = new Map();

  function put(token, factoryName, fieldName, cnText) {
    const cn = String(cnText ?? "");
    if (!cn) return;

    if (!dict.has(token)) {
      const ko = tr(cfgMap, factoryName, fieldName, cn);
      dict.set(token, { cn, ko, factoryName, fieldName });
    }
  }

  function tok(prefix, id, pathParts, factoryName, fieldName, cnText) {
    const token = [prefix, String(id), ...pathParts].join("_");
    put(token, factoryName, fieldName, cnText);
    return token;
  }

  return { dict, tok };
}

// -------------------- DB Builders --------------------
function buildCharDb(ctx) {
  const { unitList, unitViewById, tok, includedUnitIds } = ctx;
  const out = {};

  for (const u of unitList) {
    const id = safeNumber(u?.id);
    if (!id) continue;

    // 포함 기준: BookFactory(角色图鉴) 목록
    if (!includedUnitIds.has(id)) continue;

    const viewId = safeNumber(u?.viewId);
    let roleListResUrl = "";
    if (viewId !== null) {
      const viewRec = unitViewById.get(viewId) || null;
      roleListResUrl = String(viewRec?.roleListResUrl ?? "").trim();
    }

    out[String(id)] = {
      id,
      name: tok("char_name", id, [], "UnitFactory", "name", u?.name),

      // 이미지 경로(단일): UnitViewFactory.roleListResUrl
      roleListResUrl,

      quality: u?.quality ?? "",
      sideId: safeNumber(u?.sideId) ?? null,

      passiveSkillList: Array.isArray(u?.passiveSkillList)
        ? u.passiveSkillList
        : [],
      skillList: Array.isArray(u?.skillList) ? u.skillList : [],

      tk_SN: u?.tk_SN ?? null,
      hp_SN: u?.hp_SN ?? null,
      def_SN: u?.def_SN ?? null,
      atk_SN: u?.atk_SN ?? null,
      atkSpeed_SN: u?.atkSpeed_SN ?? null,
      luck_SN: u?.luck_SN ?? null,

      talentList: Array.isArray(u?.talentList) ? u.talentList : [],
      breakthroughList: Array.isArray(u?.breakthroughList)
        ? u.breakthroughList
        : [],

      line: u?.line ?? null,
      subLine: u?.subLine ?? null,

      identity: tok(
        "char_identity",
        id,
        [],
        "UnitFactory",
        "identity",
        u?.identity
      ),
      ability: tok(
        "char_ability",
        id,
        [],
        "UnitFactory",
        "ability",
        u?.ability
      ),

      controllerId: u?.controllerId ?? null,

      equipmentSlotList: Array.isArray(u?.equipmentSlotList)
        ? u.equipmentSlotList
        : [],
      homeSkillList: Array.isArray(u?.homeSkillList) ? u.homeSkillList : [],
    };
  }

  return out;
}

function buildEquipDb(ctx) {
  const { equipmentList, tok, includedEquipIds } = ctx;
  const out = {};

  for (const e of equipmentList) {
    const id = safeNumber(e?.id);
    if (!id) continue;

    // 포함 기준: BookFactory(角色装备图鉴) 목록
    if (!includedEquipIds.has(id)) continue;

    const getway = Array.isArray(e?.Getway) ? e.Getway : [];
    const getwayOut = getway.map((gw, idx) => {
      const o = { ...gw };
      if (typeof o?.DisplayName === "string" && o.DisplayName) {
        o.DisplayName = tok(
          "equip_Getway",
          id,
          [String(idx), "DisplayName"],
          "EquipmentFactory",
          "DisplayName",
          gw.DisplayName
        );
      }
      return o;
    });

    const tipsPath = String(e?.tipsPath ?? "").trim();

    out[String(id)] = {
      id,
      name: tok("equip_name", id, [], "EquipmentFactory", "name", e?.name),
      des: tok(
        "equip_des",
        id,
        [],
        "EquipmentFactory",
        "des",
        e?.des ?? e?.description
      ),

      // 이미지 경로(단일): EquipmentFactory.tipsPath
      tipsPath,

      equipTagId: safeNumber(e?.equipTagId) ?? null,
      quality: e?.quality ?? "",
      skillList: Array.isArray(e?.skillList) ? e.skillList : [],
      Getway: getwayOut,
    };
  }

  return out;
}

function buildSkillDb(ctx) {
  const { skillList, tok } = ctx;
  const out = {};

  for (const s of Array.isArray(skillList) ? skillList : []) {
    const id = safeNumber(s?.id);
    if (!id) continue;

    const iconPath = String(s?.iconPath ?? "").trim();

    // 스킬은 BookFactory로 포함 세트를 만들기 어려움(참조 기반으로 필요한 것만 뽑아도 됨)
    // 현재는 "전체 포함"으로 둔다. (필요하면 후속 단계에서 '참조된 스킬만'로 축소 가능)
    out[String(id)] = {
      id,
      name: tok("skill_name", id, [], "SkillFactory", "name", s?.name),
      mod: s?.mod ?? "",

      // 이미지 경로(단일): SkillFactory.iconPath
      iconPath,

      description: tok(
        "skill_description",
        id,
        [],
        "SkillFactory",
        "description",
        s?.description
      ),
      detailDescription: tok(
        "skill_detailDescription",
        id,
        [],
        "SkillFactory",
        "detailDescription",
        s?.detailDescription
      ),
      ExSkillList: Array.isArray(s?.ExSkillList) ? s.ExSkillList : [],
      cardID: safeNumber(s?.cardID) ?? null,
      leaderCardConditionDesc: tok(
        "skill_leaderCardConditionDesc",
        id,
        [],
        "SkillFactory",
        "leaderCardConditionDesc",
        s?.leaderCardConditionDesc
      ),
      desParamList: Array.isArray(s?.desParamList) ? s.desParamList : [],
      skillParamList: Array.isArray(s?.skillParamList) ? s.skillParamList : [],
    };
  }

  return out;
}

function buildCardDb(ctx) {
  const { cardList, tok } = ctx;
  const out = {};

  for (const c of Array.isArray(cardList) ? cardList : []) {
    const id = safeNumber(c?.id);
    if (!id) continue;

    out[String(id)] = {
      id,
      idCN: c?.idCN ?? "",
      name: tok("card_name", id, [], "CardFactory", "name", c?.name),
      color: c?.color ?? "",
      cost_SN: c?.cost_SN ?? null,
      cardType: c?.cardType ?? "",

      ExCondList: Array.isArray(c?.ExCondList) ? c.ExCondList : [],
      ExActList: Array.isArray(c?.ExActList) ? c.ExActList : [],
      tagList: Array.isArray(c?.tagList) ? c.tagList : [],
    };
  }

  return out;
}

function buildTagDb(ctx) {
  const { tagList, tok } = ctx;
  const out = {};

  for (const t of Array.isArray(tagList) ? tagList : []) {
    const id = safeNumber(t?.id);
    if (!id) continue;

    const detail = String(t?.detail ?? "").trim();

    out[String(id)] = {
      id,
      idCN: t?.idCN ?? "",
      tagName: tok("tag_tagName", id, [], "TagFactory", "tagName", t?.tagName),
      mod: t?.mod ?? "",
      detail: detail
        ? tok("tag_detail", id, [], "TagFactory", "detail", detail)
        : "",
    };
  }

  return out;
}

function buildImgDb(ctx) {
  const {
    unitList,
    unitViewById,
    equipmentList,
    skillList,
    cardList,
    talentList,
    breakthroughList,
    includedUnitIds,
    includedEquipIds,
  } = ctx;

  const out = {};

  // char_* : UnitViewFactory.roleListResUrl
  for (const u of Array.isArray(unitList) ? unitList : []) {
    const id = safeNumber(u?.id);
    if (!id) continue;

    if (includedUnitIds && includedUnitIds.size && !includedUnitIds.has(id))
      continue;

    const viewId = safeNumber(u?.viewId);
    if (viewId === null) continue;

    const viewRec = unitViewById.get(viewId) || null;
    const p = String(viewRec?.roleListResUrl ?? "").trim();
    if (p) out[`char_${id}`] = p;
  }

  // equip_* : EquipmentFactory.tipsPath
  for (const e of Array.isArray(equipmentList) ? equipmentList : []) {
    const id = safeNumber(e?.id);
    if (!id) continue;

    if (includedEquipIds && includedEquipIds.size && !includedEquipIds.has(id))
      continue;

    const p = String(e?.tipsPath ?? "").trim();
    if (p) out[`equip_${id}`] = p;
  }

  // skill_* : SkillFactory.iconPath
  for (const s of Array.isArray(skillList) ? skillList : []) {
    const id = safeNumber(s?.id);
    if (!id) continue;

    const p = String(s?.iconPath ?? "").trim();
    if (p) out[`skill_${id}`] = p;
  }

  // card_* : CardFactory.iconPath
  for (const c of Array.isArray(cardList) ? cardList : []) {
    const id = safeNumber(c?.id);
    if (!id) continue;

    const p = String(c?.iconPath ?? "").trim();
    if (p) out[`card_${id}`] = p;
  }

  // talent_* : TalentFactory.path
  for (const t of Array.isArray(talentList) ? talentList : []) {
    const id = safeNumber(t?.id);
    if (!id) continue;

    const p = String(t?.path ?? "").trim();
    if (p) out[`talent_${id}`] = p;
  }

  // break_* : BreakthroughFactory.path
  for (const b of Array.isArray(breakthroughList) ? breakthroughList : []) {
    const id = safeNumber(b?.id);
    if (!id) continue;

    const p = String(b?.path ?? "").trim();
    if (p) out[`break_${id}`] = p;
  }

  return out;
}

function buildTagColorMapping(ctx) {
  const { tagList } = ctx;
  const out = {};

  for (const t of Array.isArray(tagList) ? tagList : []) {
    const id = safeNumber(t?.id);
    if (!id) continue;

    const rich = String(t?.tagNameRichText ?? "").trim();
    const m = rich.match(/<color\s*=\s*(#[0-9a-fA-F]{6})\s*>/);
    if (!m) continue;

    const hex = String(m[1]).toUpperCase();
    if (!out[hex]) out[hex] = [];
    out[hex].push(id);
  }

  // stable output
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a - b);
  }

  return out;
}

function buildTalentDb(ctx) {
  const { talentList, tok } = ctx;
  const out = {};

  for (const r of Array.isArray(talentList) ? talentList : []) {
    const id = safeNumber(r?.id);
    if (!id) continue;

    const p = String(r?.path ?? "").trim();

    out[String(id)] = {
      id,
      name: tok("talent_name", id, [], "TalentFactory", "name", r?.name),
      desc: tok("talent_desc", id, [], "TalentFactory", "desc", r?.desc),

      // 이미지 경로(단일): TalentFactory.path
      path: p,

      awakeLv: r?.awakeLv ?? null,
      skillParamOffsetList: Array.isArray(r?.skillParamOffsetList)
        ? r.skillParamOffsetList
        : [],
    };
  }

  return out;
}

function buildBreakDb(ctx) {
  const { breakthroughList, tok } = ctx;
  const out = {};

  for (const r of Array.isArray(breakthroughList) ? breakthroughList : []) {
    const id = safeNumber(r?.id);
    if (!id) continue;

    const name = String(r?.name ?? "").trim();
    const desc = String(r?.desc ?? "").trim();
    const p = String(r?.path ?? "").trim();

    out[String(id)] = {
      id,
      name: name
        ? tok("break_name", id, [], "BreakthroughFactory", "name", name)
        : "",
      desc: desc
        ? tok("break_desc", id, [], "BreakthroughFactory", "desc", desc)
        : "",

      // 이미지 경로(단일): BreakthroughFactory.path
      path: p,

      attributeList: Array.isArray(r?.attributeList) ? r.attributeList : [],
    };
  }

  return out;
}

function buildHomeSkillDb(ctx) {
  const { homeSkillList, tok } = ctx;
  const out = {};

  for (const r of Array.isArray(homeSkillList) ? homeSkillList : []) {
    const id = safeNumber(r?.id);
    if (!id) continue;

    out[String(id)] = {
      id,
      name: tok("home_skill_name", id, [], "HomeSkillFactory", "name", r?.name),
      desc: tok("home_skill_desc", id, [], "HomeSkillFactory", "desc", r?.desc),
      param: r?.param ?? null,
      homeSkillType: r?.homeSkillType ?? "",
    };
  }

  return out;
}

// -------------------- Map Builders --------------------
function buildCharSkillMap(charDb, skillById, cardById) {
  const out = {};

  for (const cid of Object.keys(charDb)) {
    const crec = charDb[cid];
    if (!crec) continue;

    // 1️⃣ 기본 스킬
    const skills = Array.isArray(crec.skillList)
      ? crec.skillList.map((s) => safeNumber(s?.skillId)).filter(Boolean)
      : [];

    const uniqSkills = Array.from(new Set(skills));

    // 2️⃣ ExSkill 분류
    const relatedSet = new Set();
    const notFromSet = new Set();

    for (const sid of uniqSkills) {
      const srec = skillById.get(sid);
      if (!srec) continue;

      const exList = Array.isArray(srec.ExSkillList) ? srec.ExSkillList : [];
      for (const ex of exList) {
        const exId =
          typeof ex === "number"
            ? safeNumber(ex)
            : safeNumber(ex?.ExSkillName) ?? safeNumber(ex?.id);

        if (!exId) continue;

        // 🔴 黑卡可销毁(tagId=12601890) 차단
        const exSkillRec = skillById.get(exId);
        if (exSkillRec) {
          const cardId = safeNumber(exSkillRec.cardID);
          if (cardId) {
            const cardRec = cardById.get(cardId);
            const tagList = Array.isArray(cardRec?.tagList)
              ? cardRec.tagList
              : [];

            const hasBlackDestroyable = tagList.some(
              (t) => safeNumber(t?.tagId) === 12601890
            );

            if (hasBlackDestroyable) {
              continue; // 🔥 related / notFrom 어디에도 넣지 않음
            }
          }
        }

        // 기존 분기 유지
        if (ex?.isNeturality === true) {
          notFromSet.add(exId);
        } else {
          relatedSet.add(exId);
        }
      }
    }

    // 3️⃣ 결과
    out[String(cid)] = {
      skills: uniqSkills,
      relatedSkills: Array.from(relatedSet),
      notFromCharacters: Array.from(notFromSet),
    };
  }

  return out;
}

function buildItemSkillMap(equipDb, skillById) {
  const out = {};

  for (const [eid, e] of Object.entries(equipDb)) {
    const sl = Array.isArray(e?.skillList) ? e.skillList : [];
    if (sl.length <= 0) continue;

    const related = new Set();

    for (const it of sl) {
      const sid = safeNumber(it?.skillId);
      if (!sid) continue;

      const srec = skillById.get(sid) || null;
      if (!srec) continue;

      const exList = Array.isArray(srec?.ExSkillList) ? srec.ExSkillList : [];
      for (const ex of exList) {
        const exId =
          typeof ex === "number"
            ? safeNumber(ex)
            : safeNumber(ex?.ExSkillName) ?? safeNumber(ex?.id);

        if (exId) related.add(exId);
      }
    }

    if (related.size > 0) {
      out[String(eid)] = { relatedSkills: Array.from(related) };
    }
  }

  return out;
}

// -------------------- Lang Merge --------------------
function mergeLang(existing, addMap) {
  const out = existing && typeof existing === "object" ? { ...existing } : {};
  for (const [k, v] of addMap.entries()) {
    if (!Object.prototype.hasOwnProperty.call(out, k)) {
      out[k] = v;
    }
  }
  return out;
}

// -------------------- Reports: BookFactory 포함/제외 검증 --------------------
function writeBookReports(includedSets, equipmentList, unitList) {
  const equipFactoryIds = new Set();
  for (const r of equipmentList) {
    const id = safeNumber(r?.id);
    if (id !== null) equipFactoryIds.add(id);
  }

  const unitFactoryIds = new Set();
  for (const r of unitList) {
    const id = safeNumber(r?.id);
    if (id !== null) unitFactoryIds.add(id);
  }

  const equipNotInBook = [];
  const equipInBook = [];

  for (const id of equipFactoryIds) {
    if (includedSets.equipIds.has(id)) equipInBook.push(id);
    else equipNotInBook.push(id);
  }

  // not-in-book 중 Getway가 존재하는 장비 목록(예: 11800010 같은 케이스 검증)
  const equipNotInBookWithGetway = [];
  for (const r of equipmentList) {
    const id = safeNumber(r?.id);
    if (id === null) continue;
    if (includedSets.equipIds.has(id)) continue;

    const g = r?.Getway;
    const hasGetway = Array.isArray(g) && g.length > 0;
    if (hasGetway) {
      equipNotInBookWithGetway.push({
        id,
        idCN: String(r?.idCN ?? ""),
        name: String(r?.name ?? ""),
        getwayCount: g.length,
        getwayDisplayNames: g
          .map((x) => String(x?.DisplayName ?? ""))
          .filter(Boolean),
      });
    }
  }

  const reportEquip = {
    bookEquipIdCN: BOOK_EQUIP_IDCN,
    bookEquipCount: includedSets.equipIds.size,
    factoryEquipCount: equipFactoryIds.size,
    factoryEquipInBookCount: equipInBook.length,
    factoryEquipNotInBookCount: equipNotInBook.length,
    factoryEquipNotInBookWithGetwayCount: equipNotInBookWithGetway.length,
    factoryEquipNotInBookWithGetway: equipNotInBookWithGetway.sort(
      (a, b) => a.id - b.id
    ),
    sampleFactoryEquipNotInBook: equipNotInBook
      .sort((a, b) => a - b)
      .slice(0, 50),
  };

  const unitNotInBook = [];
  const unitInBook = [];
  for (const id of unitFactoryIds) {
    if (includedSets.unitIds.has(id)) unitInBook.push(id);
    else unitNotInBook.push(id);
  }

  const reportUnit = {
    bookUnitIdCN: BOOK_UNIT_IDCN,
    bookUnitCount: includedSets.unitIds.size,
    factoryUnitCount: unitFactoryIds.size,
    factoryUnitInBookCount: unitInBook.length,
    factoryUnitNotInBookCount: unitNotInBook.length,
    sampleFactoryUnitNotInBook: unitNotInBook
      .sort((a, b) => a - b)
      .slice(0, 50),
  };

  writeJson(path.join(OUT_DIR, "report_bookfactory_equip.json"), reportEquip);
  writeJson(path.join(OUT_DIR, "report_bookfactory_unit.json"), reportUnit);
}
// -------------------- 이미지 경로 정규화 --------------------

function normalizeImgPath(p) {
  let s = String(p ?? "").trim();
  if (!s) return "";

  // 필수 조건: 역슬래시 -> 슬래시
  s = s.replace(/\\/g, "/");

  // 중복 슬래시 정리
  s = s.replace(/\/{2,}/g, "/");

  // 상대경로 기준으로 앞/뒤 슬래시 제거
  s = s.replace(/^\/+/, "").replace(/\/+$/, "");

  return s;
}

function resolveImagePathByExt(assetRootDirAbs, noExtPath) {
  const png = path.join(assetRootDirAbs, `${noExtPath}.png`);
  if (fs.existsSync(png)) {
    return `${noExtPath}.png`;
  }

  const webp = path.join(assetRootDirAbs, `${noExtPath}.webp`);
  if (fs.existsSync(webp)) {
    return `${noExtPath}.webp`;
  }

  // 둘 다 없으면 no-ext 그대로 유지
  return noExtPath;
}

function applyImagePathResolveToDbField(dbObj, fieldName, assetRootDirAbs) {
  for (const rec of Object.values(dbObj)) {
    if (!rec || typeof rec !== "object") continue;

    const raw = rec[fieldName];
    if (typeof raw !== "string" || !raw.trim()) {
      rec[fieldName] = "";
      continue;
    }

    const norm = normalizeImgPath(raw);
    rec[fieldName] = resolveImagePathByExt(assetRootDirAbs, norm);
  }
}

// -------------------- MAIN --------------------
function main() {
  const cfgMap = loadConfigLanguage(CONFIG_LANG_PATH);

  const bookFactory = loadFactoryList("BookFactory.json");
  const includedSets = buildIncludedIdSetsFromBook(bookFactory);

  const unitList = loadFactoryList("UnitFactory.json");
  const unitViewList = loadFactoryList("UnitViewFactory.json");
  const unitViewById = buildIdMap(unitViewList);

  const equipmentList = loadFactoryList("EquipmentFactory.json");
  const skillList = loadFactoryList("SkillFactory.json");
  const cardList = loadFactoryList("CardFactory.json");
  const tagList = loadFactoryList("TagFactory.json");
  const talentList = loadFactoryList("TalentFactory.json");
  const breakthroughList = loadFactoryList("BreakthroughFactory.json");
  const homeSkillList = loadFactoryList("HomeSkillFactory.json");

  const { dict, tok } = makeLangCollector(cfgMap);

  // 1) DB 생성
  const charDb = buildCharDb({
    unitList,
    unitViewById,
    tok,
    includedUnitIds: includedSets.unitIds,
  });
  const equipDb = buildEquipDb({
    equipmentList,
    tok,
    includedEquipIds: includedSets.equipIds,
  });
  const skillDb = buildSkillDb({ skillList, tok });
  const cardDb = buildCardDb({ cardList, tok });
  const tagDb = buildTagDb({ tagList, tok });

  const tagColorMapping = buildTagColorMapping({ tagList });
  const talentDb = buildTalentDb({ talentList, tok });
  const breakDb = buildBreakDb({ breakthroughList, tok });
  const homeSkillDb = buildHomeSkillDb({ homeSkillList, tok });

  // 2) Map 생성(ExSkillList 1-depth)
  const skillById = buildIdMap(skillList);
  const cardById = buildIdMap(cardList);
  const tagById = buildIdMap(tagList);

  const charSkillMap = buildCharSkillMap(charDb, skillById, cardById);
  const itemSkillMap = buildItemSkillMap(equipDb, skillById);

  // 3) lang 생성
  const addCn = new Map();
  const addKo = new Map();
  for (const [token, meta] of dict.entries()) {
    addCn.set(token, meta.cn);
    addKo.set(token, meta.ko);
  }

  const langCnPath = path.join(OUT_DIR, "lang_cn.json");
  const langKoPath = path.join(OUT_DIR, "lang_ko.json");
  const langEnPath = path.join(OUT_DIR, "lang_en.json");
  const langJpPath = path.join(OUT_DIR, "lang_jp.json");
  const langTwPath = path.join(OUT_DIR, "lang_tw.json");

  const baseCn = MERGE_EXISTING_LANG ? readJsonIfExists(langCnPath) : null;
  const baseKo = MERGE_EXISTING_LANG ? readJsonIfExists(langKoPath) : null;
  const baseEn = MERGE_EXISTING_LANG ? readJsonIfExists(langEnPath) : null;
  const baseJp = MERGE_EXISTING_LANG ? readJsonIfExists(langJpPath) : null;
  const baseTw = MERGE_EXISTING_LANG ? readJsonIfExists(langTwPath) : null;

  const langCn = mergeLang(baseCn, addCn);
  const langKo = mergeLang(baseKo, addKo);

  function fillFallback(base) {
    const out = base && typeof base === "object" ? { ...base } : {};
    for (const [k, v] of addCn.entries()) {
      if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = v;
    }
    return out;
  }

  const langEn = fillFallback(baseEn);
  const langJp = fillFallback(baseJp);
  const langTw = fillFallback(baseTw);

  const assetRootDirAbs = path.join(ROOT, "public", "assets");

  // 단일 이미지 경로 필드만 처리
  applyImagePathResolveToDbField(charDb, "roleListResUrl", assetRootDirAbs);
  applyImagePathResolveToDbField(equipDb, "tipsPath", assetRootDirAbs);
  applyImagePathResolveToDbField(skillDb, "iconPath", assetRootDirAbs);
  applyImagePathResolveToDbField(talentDb, "path", assetRootDirAbs);
  applyImagePathResolveToDbField(breakDb, "path", assetRootDirAbs);

  // 4) write outputs
  writeJson(path.join(OUT_DIR, "char_db.json"), charDb);
  writeJson(path.join(OUT_DIR, "equip_db.json"), equipDb);
  writeJson(path.join(OUT_DIR, "skill_db.json"), skillDb);
  writeJson(path.join(OUT_DIR, "card_db.json"), cardDb);
  writeJson(path.join(OUT_DIR, "tag_db.json"), tagDb);

  // img_db.json은 “원본을 그대로 쓰는” 단계라면 여기 write는 계속 주석 유지
  //writeJson(path.join(OUT_DIR, "img_db.json"), imgDb);

  writeJson(path.join(OUT_DIR, "tag_color_mapping.json"), tagColorMapping);
  writeJson(path.join(OUT_DIR, "talent_db.json"), talentDb);
  writeJson(path.join(OUT_DIR, "break_db.json"), breakDb);
  writeJson(path.join(OUT_DIR, "home_skill_db.json"), homeSkillDb);

  writeJson(path.join(OUT_DIR, "char_skill_map.json"), charSkillMap);
  writeJson(path.join(OUT_DIR, "item_skill_map.json"), itemSkillMap);

  writeJson(langCnPath, langCn);
  writeJson(langKoPath, langKo);
  writeJson(langEnPath, langEn);
  writeJson(langJpPath, langJp);
  writeJson(langTwPath, langTw);

  // 5) 검증 리포트
  if (WRITE_REPORTS) {
    writeBookReports(includedSets, equipmentList, unitList);
  }

  console.log(
    "[ok] BookFactory unitIds =",
    includedSets.unitIds.size,
    "-> char_db =",
    Object.keys(charDb).length
  );
  console.log(
    "[ok] BookFactory equipIds =",
    includedSets.equipIds.size,
    "-> equip_db =",
    Object.keys(equipDb).length
  );
  console.log(
    "[ok] skill_db =",
    Object.keys(skillDb).length,
    "card_db =",
    Object.keys(cardDb).length
  );
  console.log("[ok] tokens added =", dict.size);
  if (WRITE_REPORTS)
    console.log(
      "[ok] reports written: report_bookfactory_equip.json, report_bookfactory_unit.json"
    );
}

main();
