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

const CN_DIR = path.join(ROOT, "public", "db", "CN");

// {langDir}\ConfigLanguage.json 을 로드해서 lang_{code}.json 생성
// dir: ConfigLanguage.json 위치 폴더명
// code: 출력 파일명에 들어갈 소문자 코드
const LANG_TARGETS = [
  { dir: "KR", code: "ko" },
  { dir: "JP", code: "jp" },
  { dir: "EN", code: "en" },
  { dir: "TW", code: "tw" },
];

function getConfigLanguagePathByDir(dirName) {
  // {langDir}\ConfigLanguage.json
  return path.join(ROOT, "public", "db", dirName, "ConfigLanguage.json");
}

const OUT_DIR = path.join(ROOT, "public", "db");

// BookFactory 기반 포함 규칙(가설):
// - Unit: BookFactory.idCN === "角色图鉴" 의 unitList
// - Equip: BookFactory.idCN === "角色装备图鉴" 의 equipmentList
const BOOK_UNIT_IDCN = "角色图鉴";
const BOOK_EQUIP_IDCN = "角色装备图鉴";
const BOOK_SOURCE_IDCN = "素材图鉴";
const BOOK_ARMAMENT_IDCN = "列车武装图鉴";

// 검증 리포트 출력 여부
const WRITE_REPORTS = false;

const assetRootDirAbs = path.join(ROOT, "public", "assets");
const pngNoExtMap = buildPngNoExtMap(assetRootDirAbs);

function buildPngNoExtMap(rootDirAbs) {
  const map = new Map();

  function walk(dirAbs) {
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });

    for (const e of entries) {
      const abs = path.join(dirAbs, e.name);

      if (e.isDirectory()) {
        walk(abs);
        continue;
      }

      if (!e.isFile()) continue;
      if (!/\.webp$/i.test(e.name)) continue;

      // root 기준 상대경로 (확장자 제거)
      const rel = path.relative(rootDirAbs, abs).replace(/\\/g, "/");
      const relNoExt = rel.replace(/\.webp$/i, "");
      const key = relNoExt.toLowerCase();

      // 최초 발견한 실제 케이스만 저장
      if (!map.has(key)) {
        map.set(key, relNoExt);
      }
    }
  }

  walk(rootDirAbs);
  return map;
}

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

  // 추가: 소재/열차무장 도감
  const sourceBook = getBookListByIdCN(bookFactory, BOOK_SOURCE_IDCN);
  const armamentBook = getBookListByIdCN(bookFactory, BOOK_ARMAMENT_IDCN);

  const unitIds = new Set();
  const equipIds = new Set();
  const sourceIds = new Set();
  const armamentIds = new Set();

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

  // 소재 도감: sourceList
  const sourceList = Array.isArray(sourceBook?.sourceList)
    ? sourceBook.sourceList
    : [];
  for (const s of sourceList) {
    const id = safeNumber(s?.id);
    if (id !== null) sourceIds.add(id);
  }

  // 열차무장 도감: armamentList
  const armamentList = Array.isArray(armamentBook?.armamentList)
    ? armamentBook.armamentList
    : [];
  for (const a of armamentList) {
    const id = safeNumber(a?.id);
    if (id !== null) armamentIds.add(id);
  }

  return {
    unitIds,
    equipIds,
    sourceIds,
    armamentIds,
    unitBookId: unitBook?.id ?? null,
    equipBookId: equipBook?.id ?? null,
    sourceBookId: sourceBook?.id ?? null,
    armamentBookId: armamentBook?.id ?? null,
  };
}

// -------------------- Tokenizer + Lang Collector --------------------
function makeLangCollector() {
  // token -> { cn, factoryName, fieldName }
  const dict = new Map();

  function put(token, factoryName, fieldName, cnText) {
    const cn = String(cnText ?? "");
    if (!cn) return;

    if (!dict.has(token)) {
      dict.set(token, { cn, factoryName, fieldName });
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
    let face = "";

    if (viewId !== null) {
      const viewRec = unitViewById.get(viewId) || null;
      roleListResUrl = String(viewRec?.roleListResUrl ?? "").trim();

      if (roleListResUrl) {
        const norm = normalizeImgPath(roleListResUrl); // \ -> / 포함 정규화
        face = norm.replace(/[^/]+$/, "Face.webp"); // 마지막 파일명만 치환
      }
    }

    out[String(id)] = {
      id,
      name: tok("char_name", id, [], "UnitFactory", "name", u?.name),

      // 이미지 경로(단일): UnitViewFactory.roleListResUrl
      roleListResUrl,
      face,
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

      gender: tok("char_gender", id, [], "UnitFactory", "gender", u?.gender),
      birthday: tok(
        "char_birthday",
        id,
        [],
        "UnitFactory",
        "birthday",
        u?.birthday
      ),
      height: u?.height ?? null,

      birthplace: tok(
        "char_birthplace",
        id,
        [],
        "UnitFactory",
        "birthplace",
        u?.birthplace
      ),

      getCharacter: tok(
        "char_getCharacter",
        id,
        [],
        "UnitFactory",
        "getCharacter",
        u?.getCharacter
      ),

      ResumeList: Array.isArray(u?.ResumeList)
        ? u.ResumeList.map((r, idx) => ({
            ...r,
            des: tok(
              "char_resume_des",
              id,
              [String(idx), "des"],
              "UnitFactory",
              "des", // 여기만 "ResumeList.des" -> "des"
              r?.des
            ),
          }))
        : [],

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

    let type = null;

    const attackSN = safeNumber(e?.attack_SN);
    const hpSN = safeNumber(e?.healthPoint_SN);
    const defSN = safeNumber(e?.defence_SN);

    if (attackSN !== null && attackSN > 0) {
      type = "weapon";
    } else if (hpSN !== null && hpSN > 0) {
      type = "accessory";
    } else if (defSN !== null && defSN > 0) {
      type = "armor";
    }

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
      type,
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
  const { skillList, tok, usedSkillIds } = ctx;
  const out = {};

  for (const s of Array.isArray(skillList) ? skillList : []) {
    const id = safeNumber(s?.id);
    if (!id) continue;

    // ⭐ char/equip 어디에서도 참조되지 않은 스킬은 제외
    if (!usedSkillIds.has(id)) continue;

    const iconPath = String(s?.iconPath ?? "").trim();

    out[String(id)] = {
      id,
      name: tok("skill_name", id, [], "SkillFactory", "name", s?.name),
      mod: s?.mod ?? "",
      iconPath,
      isPercent: typeof s?.isPercent === "boolean" ? s.isPercent : undefined,
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
      iconPath: c?.iconPath ?? "",
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
      // 이미지 경로
      path: p,
      awakeLv: r?.awakeLv ?? null,
      skillIntensify: safeNumber(r?.skillIntensify) || null,
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

function buildSourceMaterialDb(ctx) {
  const { sourceMaterialList, tok, includedSourceIds } = ctx;
  const out = {};

  for (const r of Array.isArray(sourceMaterialList) ? sourceMaterialList : []) {
    const id = safeNumber(r?.id);
    if (!id) continue;

    // 포함 기준: BookFactory(素材图鉴) 목록
    if (!includedSourceIds.has(id)) continue;

    out[String(id)] = {
      id,
      // UI에서 쓰는 핵심(요청한 것들 위주)
      name: tok("sm_name", id, [], "SourceMaterialFactory", "name", r?.name),
      quality: r?.quality ?? "",
      iconPath: String(r?.iconPath ?? "").trim(),

      // 상세(있으면 표시)
      des: tok(
        "sm_des",
        id,
        [],
        "SourceMaterialFactory",
        "des",
        r?.des ?? r?.description
      ),
      effect: tok(
        "sm_effect",
        id,
        [],
        "SourceMaterialFactory",
        "effect",
        r?.effect
      ),
      Getway: Array.isArray(r?.Getway) ? r.Getway : [],
      type: r?.type ?? null,
    };
  }

  return out;
}

function buildItemDb(ctx) {
  const { itemList, tok } = ctx;
  const out = {};

  for (const r of Array.isArray(itemList) ? itemList : []) {
    const id = safeNumber(r?.id);
    if (!id) continue;

    out[String(id)] = {
      id,
      name: tok("item_name", id, [], "ItemFactory", "name", r?.name),
      quality: r?.quality ?? "",
      iconPath: String(r?.iconPath ?? "").trim(),

      // 상세(있으면 표시)
      des: tok(
        "item_des",
        id,
        [],
        "ItemFactory",
        "des",
        r?.des ?? r?.description
      ),
      effect: tok("item_effect", id, [], "ItemFactory", "effect", r?.effect),
      Getway: Array.isArray(r?.Getway) ? r.Getway : [],
      type: r?.type ?? null,
    };
  }

  return out;
}

function buildHomeWeaponDb(ctx) {
  const {
    homeWeaponList,
    tok,
    includedArmamentIds,

    tagById,
    trainWeaponSkillById,
    engineCoreById,
  } = ctx;

  function buildTagJoin(tagId) {
    const id = safeNumber(tagId);
    if (!id) return null;

    const t = tagById?.get(id) || null;
    if (!t) return { id, tagName: "" };

    return {
      id,
      tagName: tok("tag_tagName", id, [], "TagFactory", "tagName", t?.tagName),
    };
  }

  function buildEntryJoin(list, homeWeaponId, groupName) {
    const src = Array.isArray(list) ? list : [];
    const out = [];

    for (let i = 0; i < src.length; i += 1) {
      const sid = safeNumber(src[i]?.id);
      if (!sid) continue;

      const s = trainWeaponSkillById?.get(sid) || null;
      if (!s) {
        out.push({ id: sid });
        continue;
      }

      out.push({
        id: sid,
        name: tok(
          "tws_name",
          sid,
          [],
          "TrainWeaponSkillFactory",
          "name",
          s?.name
        ),
        text: tok(
          "tws_text",
          sid,
          [],
          "TrainWeaponSkillFactory",
          "text",
          s?.text
        ),

        // 수치 필드들은 파일에 있는 그대로 보존(해석은 UI에서)
        Constant: safeNumber(s?.Constant) ?? null,
        randomConstant: safeNumber(s?.randomConstant) ?? null,
        CommonNum: safeNumber(s?.CommonNum) ?? null,

        aType: s?.aType ?? null,
        aNumMin: safeNumber(s?.aNumMin) ?? null,
        aNumMax: safeNumber(s?.aNumMax) ?? null,
        aUpgradeRange: safeNumber(s?.aUpgradeRange) ?? null,
        levelMax: safeNumber(s?.levelMax) ?? null,

        aNumMinP: safeNumber(s?.aNumMinP) ?? null,
        aNumMaxP: safeNumber(s?.aNumMaxP) ?? null,
        aUpgradeRangeP: safeNumber(s?.aUpgradeRangeP) ?? null,

        group: groupName,
      });
    }

    return out;
  }

  function pickPowerLoad(entries) {
    for (const e of entries) {
      const sid = safeNumber(e?.id);
      if (!sid) continue;

      const s = trainWeaponSkillById?.get(sid) || null;
      if (!s) continue;

      if (String(s?.name ?? "") === "电力负荷") {
        const v = safeNumber(s?.Constant);
        if (v !== null) {
          return { value: v };
        }

        if (
          safeNumber(s?.aNumMin) !== null ||
          safeNumber(s?.aNumMinP) !== null
        ) {
          return {
            aNumMin: safeNumber(s?.aNumMin) ?? null,
            aNumMax: safeNumber(s?.aNumMax) ?? null,
            aNumMinP: safeNumber(s?.aNumMinP) ?? null,
            aNumMaxP: safeNumber(s?.aNumMaxP) ?? null,
          };
        }
      }
    }

    return null;
  }

  function pickSpeed(entries) {
    for (const e of entries) {
      const sid = safeNumber(e?.id);
      if (!sid) continue;

      const s = trainWeaponSkillById?.get(sid) || null;
      if (!s) continue;

      const n = String(s?.name ?? "");
      if (n === "速度降低" || n === "速度提升") {
        const v = safeNumber(s?.Constant);
        if (v !== null) {
          return { kind: n, value: v };
        }

        return {
          kind: n,
          aNumMin: safeNumber(s?.aNumMin) ?? null,
          aNumMax: safeNumber(s?.aNumMax) ?? null,
          aNumMinP: safeNumber(s?.aNumMinP) ?? null,
          aNumMaxP: safeNumber(s?.aNumMaxP) ?? null,
        };
      }
    }

    return null;
  }

  function buildCoreList(coreList) {
    const src = Array.isArray(coreList) ? coreList : [];
    const out = [];

    for (let i = 0; i < src.length; i += 1) {
      const coreId = safeNumber(src[i]?.id);
      if (!coreId) continue;

      const level = safeNumber(src[i]?.level) ?? 0;
      const coreRec = engineCoreById?.get(coreId) || null;

      const nameCN = String(coreRec?.idCN ?? "").trim();
      const nameKey = nameCN
        ? tok("core_id", coreId, [], "EngineCoreFactory", "idCN", nameCN)
        : null;

      out.push({
        id: coreId,
        level,
        name: nameKey,
      });
    }

    return out;
  }

  function buildGetwayList(getway, homeWeaponId) {
    const src = Array.isArray(getway) ? getway : [];
    const out = [];

    for (let i = 0; i < src.length; i += 1) {
      const gw = src[i] || {};
      const o = { ...gw };

      if (typeof o?.DisplayName === "string" && o.DisplayName) {
        o.DisplayName = tok(
          "hw_Getway_DisplayName",
          homeWeaponId,
          [String(i), "DisplayName"],
          "HomeWeaponFactory",
          "DisplayName",
          gw.DisplayName
        );
      }

      if (typeof o?.UIName === "string" && o.UIName) {
        o.UIName = tok(
          "hw_Getway_UIName",
          homeWeaponId,
          [String(i), "UIName"],
          "HomeWeaponFactory",
          "UIName",
          gw.UIName
        );
      }

      out.push(o);
    }

    return out;
  }

  const out = {};

  for (const r of Array.isArray(homeWeaponList) ? homeWeaponList : []) {
    const id = safeNumber(r?.id);
    if (!id) continue;

    if (!includedArmamentIds.has(id)) continue;

    const typeWeaponJoin = buildTagJoin(r?.typeWeapon);

    const hitTags = Array.isArray(r?.hitEventType) ? r.hitEventType : [];
    const hitEventType = [];
    for (let i = 0; i < hitTags.length; i += 1) {
      const j = buildTagJoin(hitTags[i]?.id);
      if (j) hitEventType.push(j);
    }

    const normalEntryList = Array.isArray(r?.normalEntryList)
      ? r.normalEntryList
      : [];
    const growUpEntryList = Array.isArray(r?.growUpEntryList)
      ? r.growUpEntryList
      : [];

    const normalEntries = buildEntryJoin(normalEntryList, id, "normal");
    const growUpEntries = buildEntryJoin(growUpEntryList, id, "growUp");
    const allEntries = [...normalEntryList, ...growUpEntryList];

    const powerLoad = pickPowerLoad(allEntries);
    const speed = pickSpeed(allEntries);

    const coreNeed = buildCoreList(r?.coreList);
    const getwayOut = buildGetwayList(r?.Getway, id);

    out[String(id)] = {
      id,

      name: tok("hw_name", id, [], "HomeWeaponFactory", "name", r?.name),
      des: tok("hw_des", id, [], "HomeWeaponFactory", "des", r?.des),

      quality: r?.quality ?? "",
      tipsPath: String(r?.tipsPath ?? "").trim(),

      // 종류(조인 결과)
      typeWeapon: typeWeaponJoin,

      // 전력 부하 / 속도 (TrainWeaponSkillFactory 기반 추출)
      powerLoad,
      speed,

      // 코어 조건(조인 + core_id_{coreId} 토큰 생성)
      coreList: coreNeed,

      // 무장 효과(전체 엔트리 조인 결과)
      normalEntryList: normalEntries,
      growUpEntryList: growUpEntries,

      // 획득 경로(번역 매칭 토큰화)
      Getway: getwayOut,
    };
  }

  return out;
}

function buildCommodityDbSlim(ctx) {
  const { commodityList, usedItemIds, itemDb, sourceMaterialDb, equipmentDb, homeWeaponDb } =
    ctx;

  const out = {};

  for (const [cid, c] of Object.entries(commodityList)) {
    const resultList = Array.isArray(c.commodityItemList)
      ? c.commodityItemList
      : [];

    // 결과물이 실제 쓰이는 경우만
    if (!resultList.some((r) => usedItemIds.has(Number(r?.id)))) continue;

    const moneyList = (Array.isArray(c.moneyList) ? c.moneyList : [])
      .map((m) => {
        const id = Number(m?.moneyID);
        const num = Number(m?.moneyNum) || 0;
        if (!id || !num) return null;

        let nameKey = null;

        if (itemDb?.[id]) {
          nameKey = itemDb[id].name;
        } else if (sourceMaterialDb?.[id]) {
          nameKey = sourceMaterialDb[id].name;
        } else if (equipmentDb?.[id]) {
          nameKey = equipmentDb[id].name;
        } else if (homeWeaponDb?.[id]) {
          nameKey = homeWeaponDb[id].name; // 열차무장 조인 추가
        }

        return nameKey ? { id, num, nameKey } : null;
      })
      .filter(Boolean);

    out[cid] = {
      id: Number(cid),
      commodityName: c.commodityName,
      commodityItemList: resultList.map((r) => ({
        id: Number(r.id),
        num: Number(r.num) || 0,
      })),
      moneyList,
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

function collectUsedSkillIds(charDb, equipDb, talentDb, skillById) {
  const set = new Set();

  // 1) 캐릭터 기본 스킬 + 파생(ExSkillList)
  for (const c of Object.values(charDb)) {
    const sl = Array.isArray(c?.skillList) ? c.skillList : [];

    for (const it of sl) {
      const sid = safeNumber(it?.skillId);
      if (!sid) continue;

      set.add(sid);

      const srec = skillById.get(sid);
      if (!srec) continue;

      const exList = Array.isArray(srec?.ExSkillList) ? srec.ExSkillList : [];
      for (const ex of exList) {
        const exId = safeNumber(ex?.ExSkillName);
        if (exId) set.add(exId);
      }
    }
  }

  // 2) 장비 스킬
  for (const e of Object.values(equipDb)) {
    const sl = Array.isArray(e?.skillList) ? e.skillList : [];
    for (const it of sl) {
      const sid = safeNumber(it?.skillId);
      if (sid) set.add(sid);
    }
  }

  // 3) talent_db에 직접 정의된 파생 스킬
  for (const t of Object.values(talentDb)) {
    const sl = Array.isArray(t?.skillList) ? t.skillList : [];
    for (const it of sl) {
      const sid = safeNumber(it?.skillId);
      if (sid) set.add(sid);
    }
  }

  // 4) ⭐ Talent → Skill(강화) 규칙 (build_vm와 동일)
  for (const t of Object.values(talentDb)) {
    const sid = safeNumber(t?.skillIntensify);
    if (sid) set.add(sid);
  }

  return set;
}

function buildSkillIdsByCardId(skillList) {
  const map = new Map();

  for (const s of Array.isArray(skillList) ? skillList : []) {
    const sid = safeNumber(s?.id);
    if (!sid) continue;

    const cardId = safeNumber(s?.cardID);
    if (!cardId) continue;

    let arr = map.get(cardId);
    if (!arr) {
      arr = [];
      map.set(cardId, arr);
    }

    arr.push(sid);
  }

  return map;
}

function expandUsedSkillIdsByLinkedCards(usedSkillIds, cardList, skillList) {
  const skillIdsByCardId = buildSkillIdsByCardId(skillList);

  for (const c of Array.isArray(cardList) ? cardList : []) {
    const links = Array.isArray(c?.linkCardId) ? c.linkCardId : [];

    for (const it of links) {
      // linkCardId[].Id 를 cardId로 취급 (너가 말한 규칙 그대로)
      const linkedCardId = safeNumber(it?.Id);
      if (!linkedCardId) continue;

      const sids = skillIdsByCardId.get(linkedCardId) || [];
      for (const sid of sids) {
        usedSkillIds.add(sid);
      }
    }
  }
}

function writeLangJson(outPath, mapObj) {
  ensureDirForFile(outPath);
  fs.writeFileSync(outPath, JSON.stringify(mapObj, null, 2), "utf8");
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

function applyImagePathResolveToDbField(db, fieldName, assetRootDirAbs) {
  for (const id of Object.keys(db)) {
    const rec = db[id];
    let p = String(rec?.[fieldName] ?? "").trim();
    if (!p) continue;

    // 1) normalize (슬래시 정리만)
    p = normalizeImgPath(p);

    // 2) 확장자 제거
    const noExt = p.replace(/\.(png|webp)$/i, "");

    // 3) 🔴 실제 파일 기준 대소문자 교정
    const key = noExt.toLowerCase();
    if (pngNoExtMap.has(key)) {
      // 실제 파일 경로(no-ext)로 교체
      p = pngNoExtMap.get(key);
    } else {
      // 못 찾으면 기존 로직 유지 (존재 확인용)

      console.log(noExt);

      // const resolved = resolveImagePathByExt(noExt, assetRootDirAbs);
      // if (!resolved) continue;
      // p = resolved.replace(/\.(png|webp)$/i, "");
    }

    // 4) 확장자 다시 붙이기 (png 우선)
    // const absPng = path.join(assetRootDirAbs, `${p}.png`);
    const absWebp = path.join(assetRootDirAbs, `${p}.webp`);

    if (fs.existsSync(absWebp)) {
      rec[fieldName] = `${p}.webp`;
    } else {
      // 이론상 여기 안 옴 (pngNoExtMap 기준)
      rec[fieldName] = `${p}.png`;
    }
  }
}

// -------------------- MAIN --------------------
function main() {
  const { dict, tok } = makeLangCollector();

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

  // ---------- Encyclopedia join sources (no city_db) ----------
  const commodityList = loadFactoryList("CommodityFactory.json");
  const storeList = loadFactoryList("StoreFactory.json");
  const valuableList = loadFactoryList("ValuableFactory.json");
  const listList = loadFactoryList("ListFactory.json");
  const itemList2 = loadFactoryList("ItemFactory.json");
  const sourceMaterialList = loadFactoryList("SourceMaterialFactory.json");
  const homeGoodsList = loadFactoryList("HomeGoodsFactory.json");
  const expItemList = loadFactoryList("ExpItemFactory.json");
  const fridgeItemList = loadFactoryList("FridgeItemFactory.json");
  const homeWeaponList = loadFactoryList("HomeWeaponFactory.json");
  const trainWeaponSkillList = loadFactoryList("TrainWeaponSkillFactory.json");
  const engineCoreList = loadFactoryList("EngineCoreFactory.json");

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

  const itemDb = buildItemDb({
    itemList: itemList2,
    tok,
  });

  const sourceMaterialDb = buildSourceMaterialDb({
    sourceMaterialList,
    tok,
    includedSourceIds: includedSets.sourceIds, // 素材图鉴
  });

  // id -> rec
  const tagById = buildIdMap(tagList);
  const trainWeaponSkillById = buildIdMap(trainWeaponSkillList);
  const engineCoreById = buildIdMap(engineCoreList);

  const homeWeaponDb = buildHomeWeaponDb({
    homeWeaponList,
    tok,
    includedArmamentIds: includedSets.armamentIds, // 列车武装图鉴
    tagById,
    trainWeaponSkillById,
    engineCoreById,
  });

  const cardDb = buildCardDb({ cardList, tok });
  const tagDb = buildTagDb({ tagList, tok });
  const tagColorMapping = buildTagColorMapping({ tagList });
  const talentDb = buildTalentDb({ talentList, tok });

  const skillById = buildIdMap(skillList);
  const usedSkillIds = collectUsedSkillIds(
    charDb,
    equipDb,
    talentDb,
    skillById
  );

  expandUsedSkillIdsByLinkedCards(usedSkillIds, cardList, skillList);

  const skillDb = buildSkillDb({
    skillList,
    tok,
    usedSkillIds,
  });

  const breakDb = buildBreakDb({ breakthroughList, tok });
  const homeSkillDb = buildHomeSkillDb({ homeSkillList, tok });

  // 2) Map 생성(ExSkillList 1-depth)
  //const skillById = buildIdMap(skillList);
  const cardById = buildIdMap(cardList);

  const charSkillMap = buildCharSkillMap(charDb, skillById, cardById);
  const itemSkillMap = buildItemSkillMap(equipDb, skillById);

  // 단일 이미지 경로 필드만 처리
  applyImagePathResolveToDbField(charDb, "roleListResUrl", assetRootDirAbs);
  applyImagePathResolveToDbField(charDb, "face", assetRootDirAbs);
  applyImagePathResolveToDbField(equipDb, "tipsPath", assetRootDirAbs);
  applyImagePathResolveToDbField(skillDb, "iconPath", assetRootDirAbs);
  applyImagePathResolveToDbField(talentDb, "path", assetRootDirAbs);
  applyImagePathResolveToDbField(breakDb, "path", assetRootDirAbs);
  applyImagePathResolveToDbField(cardDb, "iconPath", assetRootDirAbs);

  // 추가: 아이템/소재/열차무장
  applyImagePathResolveToDbField(itemDb, "iconPath", assetRootDirAbs);
  applyImagePathResolveToDbField(sourceMaterialDb, "iconPath", assetRootDirAbs);

  // 열차무장은 프로젝트마다 imagePath/tipsPath 중 뭐 쓰는지 달라서 둘 다 처리(값 있는 것만 적용됨)
  applyImagePathResolveToDbField(homeWeaponDb, "imagePath", assetRootDirAbs);
  applyImagePathResolveToDbField(homeWeaponDb, "tipsPath", assetRootDirAbs);

  // 4) write outputs
  writeJson(path.join(OUT_DIR, "char_db.json"), charDb);
  writeJson(path.join(OUT_DIR, "equip_db.json"), equipDb);
  writeJson(path.join(OUT_DIR, "item_db.json"), itemDb);
  writeJson(path.join(OUT_DIR, "source_material_db.json"), sourceMaterialDb);
  writeJson(path.join(OUT_DIR, "home_weapon_db.json"), homeWeaponDb);
  writeJson(path.join(OUT_DIR, "skill_db.json"), skillDb);
  writeJson(path.join(OUT_DIR, "card_db.json"), cardDb);
  writeJson(path.join(OUT_DIR, "tag_db.json"), tagDb);

  writeJson(path.join(OUT_DIR, "tag_color_mapping.json"), tagColorMapping);
  writeJson(path.join(OUT_DIR, "talent_db.json"), talentDb);
  writeJson(path.join(OUT_DIR, "break_db.json"), breakDb);
  writeJson(path.join(OUT_DIR, "home_skill_db.json"), homeSkillDb);

  writeJson(path.join(OUT_DIR, "char_skill_map.json"), charSkillMap);
  writeJson(path.join(OUT_DIR, "item_skill_map.json"), itemSkillMap);

  // ---------- Encyclopedia join outputs (optimized) ----------
  // commodity_db는 너무 크므로: 장비/아이템/소재/열차무장과 연관된 항목만 + 필요한 필드만 출력한다.

  const usedItemIds = new Set();
  for (const k of Object.keys(equipDb)) usedItemIds.add(safeNumber(k));
  for (const k of Object.keys(itemDb)) usedItemIds.add(safeNumber(k));
  for (const k of Object.keys(sourceMaterialDb)) usedItemIds.add(safeNumber(k));
  for (const k of Object.keys(homeWeaponDb)) usedItemIds.add(safeNumber(k));

  const commodityDb = buildCommodityDbSlim({
    commodityList,
    usedItemIds,
    itemDb,
    sourceMaterialDb,
    equipDb,
    homeWeaponDb
  });

  writeJson(path.join(OUT_DIR, "commodity_db.json"), commodityDb);

  // lang 생성 (항상 덮어쓰기)
  const cnObj = {};
  for (const [token, meta] of dict.entries()) {
    cnObj[token] = meta.cn;
  }

  const langCnPath = path.join(OUT_DIR, "lang_cn.json");
  writeLangJson(langCnPath, cnObj);

  for (const t of LANG_TARGETS) {
    const cfgPath = getConfigLanguagePathByDir(t.dir);
    const cfgMap = fs.existsSync(cfgPath) ? loadConfigLanguage(cfgPath) : null;

    const outObj = {};
    let hit = 0;
    let miss = 0;

    for (const [token, meta] of dict.entries()) {
      const cn = meta.cn;
      const v = cfgMap ? tr(cfgMap, meta.factoryName, meta.fieldName, cn) : cn;

      if (v !== cn) {
        hit += 1;
      } else {
        miss += 1;
      }

      outObj[token] = v && typeof v === "string" ? v : cn;
    }

    console.log(
      `[DBG tr] ${t.code} hit= ${hit} miss= ${miss} total= ${hit + miss}`
    );

    const outPath = path.join(OUT_DIR, `lang_${t.code}.json`);
    writeLangJson(outPath, outObj);
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
