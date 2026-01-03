// scripts/build_verify_vm_by_book_ko_inplace.mjs
//
// 핵심 출력 형태(요청대로 “기존 리스트 원소 내부에 붙임”):
// UnitFactory:
//   skillList[]:        { num, skillId, skill: {SkillFactory...} }
//   passiveSkillList[]: { num, skillId, skill: {...} }
//   finalSkill:         number 유지 + finalSkillRec: {SkillFactory...}  (스칼라는 원소가 없어서 별도 필드로 붙임)
//   talentList[]:       { talentId, talent: {TalentFactory...} }
//   breakthroughList[]: { breakthroughId, breakthrough: {BreakthroughFactory...} }
//   homeSkillList[]:    { id, homeSkill: {HomeSkillFactory...} }
//   tagList[]:          { tagId, tag: {TagFactory...} }
//   equipmentSlotList[]:{ tagID, tag: {TagFactory...} }
//   classifyList[]:     { des, tag: {TagFactory...} }
//   careerList[]:       { des, tag: {TagFactory...} }
//   sideId:             number 유지 + sideTag: {TagFactory...}
//
// EquipmentFactory:
//   skillList[]:        { skillId, skill: {SkillFactory...} }
//   disappearSkillList[]:{ skillId, skill: {...} }
//   randomSkillList[]:  { skillId(listId), list: {ListFactory...}, skills:[{SkillFactory...}...] }  // 경유 확인용
//   equipTagId/campTagId: number 유지 + equipTag/campTag: {TagFactory...}
//   growthId:           number 유지 + growth: {GrowthFactory...}
//
// 번역:
// - build_db.mjs 방식: cfg[Factory][Field][CN]=KO, 매칭 실패 시 CN 유지

import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const CN_DIR = path.join(ROOT, "public", "db", "CN");
const KR_DIR = path.join(ROOT, "public", "db", "KR");
const CONFIG_LANG_PATH = path.join(KR_DIR, "ConfigLanguage.json");

const FACTORY_PATHS = {
  BookFactory: path.join(CN_DIR, "BookFactory.json"),
  UnitFactory: path.join(CN_DIR, "UnitFactory.json"),
  EquipmentFactory: path.join(CN_DIR, "EquipmentFactory.json"),
  SkillFactory: path.join(CN_DIR, "SkillFactory.json"),
  TalentFactory: path.join(CN_DIR, "TalentFactory.json"),
  TagFactory: path.join(CN_DIR, "TagFactory.json"),
  HomeSkillFactory: path.join(CN_DIR, "HomeSkillFactory.json"),
  CardFactory: path.join(CN_DIR, "CardFactory.json"),

  ListFactory: path.join(CN_DIR, "ListFactory.json"),
  BreakthroughFactory: path.join(CN_DIR, "BreakthroughFactory.json"),
  GrowthFactory: path.join(CN_DIR, "GrowthFactory.json"),
};

const OUT_DIR = path.join(ROOT, "public", "vm", "KR");
const OUT_PATHS = {
  UnitVM: path.join(OUT_DIR, "unit_vm.json"),
  EquipVM: path.join(OUT_DIR, "equip_vm.json"),
};

function readJsonIfExists(absPath) {
  if (!fs.existsSync(absPath)) return null;
  return JSON.parse(fs.readFileSync(absPath, "utf-8"));
}

function ensureDir(dirAbs) {
  if (!fs.existsSync(dirAbs)) {
    fs.mkdirSync(dirAbs, { recursive: true });
  }
}

function writeJsonPretty(absPath, obj) {
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2), "utf-8");
}

function normText(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function loadConfigLanguage(cfgAbsPath) {
  const cfg = readJsonIfExists(cfgAbsPath) || {};

  for (const factoryName of Object.keys(cfg)) {
    const facObj = cfg[factoryName];
    if (!facObj || typeof facObj !== "object" || Array.isArray(facObj)) continue;

    for (const fieldName of Object.keys(facObj)) {
      const mapping = facObj[fieldName];
      if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) continue;

      const add = {};
      for (const [zh, ko] of Object.entries(mapping)) {
        if (typeof zh !== "string" || typeof ko !== "string" || ko === "") continue;

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
  if (!facObj || typeof facObj !== "object") return src;

  const mapping = facObj[fieldName];
  if (!mapping || typeof mapping !== "object") return src;

  if (Object.prototype.hasOwnProperty.call(mapping, src)) return mapping[src];

  const n = normText(src);
  if (Object.prototype.hasOwnProperty.call(mapping, n)) return mapping[n];

  return src;
}

function translateDeep(cfg, factoryName, node, fieldNameForString = "") {
  if (node === null || node === undefined) return node;

  if (typeof node === "string") {
    if (!fieldNameForString) return node;
    return tr(cfg, factoryName, fieldNameForString, node);
  }

  if (typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((it) => translateDeep(cfg, factoryName, it, fieldNameForString));
  }

  const out = {};
  for (const k of Object.keys(node)) {
    out[k] = translateDeep(cfg, factoryName, node[k], k);
  }
  return out;
}

function safeNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

function buildById(list) {
  const map = new Map();
  for (const r of Array.isArray(list) ? list : []) {
    const id = safeNum(r?.id);
    if (!id) continue;
    map.set(id, r);
  }
  return map;
}

function pickBookIdSet(bookList, idCN, listFieldName) {
  const out = new Set();
  for (const b of Array.isArray(bookList) ? bookList : []) {
    if (String(b?.idCN) !== idCN) continue;
    const items = Array.isArray(b?.[listFieldName]) ? b[listFieldName] : [];
    for (const it of items) {
      const id = safeNum(it?.id);
      if (id) out.add(id);
    }
  }
  return out;
}

// ---- “원소 내부에 조인 붙이기” 유틸 ----
function attachByIdField(list, idField, outField, byId, cfg, factoryName) {
  const xs = Array.isArray(list) ? list : [];
  const out = [];

  for (const it of xs) {
    if (!it || typeof it !== "object") {
      out.push(it);
      continue;
    }

    const id = safeNum(it[idField]);
    const recCN = id ? (byId.get(id) || null) : null;

    out.push({
      ...it,
      [outField]: recCN ? translateDeep(cfg, factoryName, recCN) : null,
    });
  }

  return out;
}

function attachScalarId(obj, idField, outField, byId, cfg, factoryName) {
  const id = safeNum(obj?.[idField]);
  const recCN = id ? (byId.get(id) || null) : null;
  return { ...obj, [outField]: recCN ? translateDeep(cfg, factoryName, recCN) : null };
}

// ListFactory 레코드에서 skillId들을 “안전 탐색”으로 뽑음
function pickSkillIdsFromListRecLoose(listRec) {
  const out = [];
  if (!listRec || typeof listRec !== "object") return out;

  const candidateKeys = ["EquipmentEntryList", "entryList", "list", "skillList", "SkillList"];
  for (const k of candidateKeys) {
    const v = listRec[k];
    if (!Array.isArray(v)) continue;

    for (const e of v) {
      if (typeof e === "number") {
        out.push(e);
        continue;
      }
      const id = safeNum(e?.id);
      if (id) out.push(id);

      const sid = safeNum(e?.skillId);
      if (sid) out.push(sid);
    }

    if (out.length) return out;
  }

  return out;
}

// Skill 확장: ExSkillList 1-depth + TalentFactory에서 스킬 참조 추가(유닛에서 참조된 talent만)
function expandSkillIdSet(skillById, baseSkillIds, talentById, talentIds) {
  const all = new Set(baseSkillIds);

  if (talentById && talentIds) {
    for (const tid of talentIds) {
      const trec = talentById.get(tid) || null;
      if (!trec) continue;

      const si = safeNum(trec?.skillIntensify);
      if (si) all.add(si);

      for (const x of Array.isArray(trec?.skillList) ? trec.skillList : []) {
        const sid = safeNum(x?.skillId);
        if (sid) all.add(sid);
      }

      for (const x of Array.isArray(trec?.skillActiveUpgrade) ? trec.skillActiveUpgrade : []) {
        const sid = safeNum(x?.id);
        if (sid) all.add(sid);
      }

      for (const x of Array.isArray(trec?.skillParamOffsetList) ? trec.skillParamOffsetList : []) {
        const sid = safeNum(x?.skillId);
        if (sid) all.add(sid);
      }
    }
  }

  for (const sid of Array.from(all)) {
    const srec = skillById.get(sid) || null;
    if (!srec) continue;

    const exList = Array.isArray(srec?.ExSkillList) ? srec.ExSkillList : [];
    for (const ex of exList) {
      if (typeof ex === "number") {
        const n = safeNum(ex);
        if (n) all.add(n);
      } else {
        const n = safeNum(ex?.ExSkillName);
        if (n) all.add(n);
      }
    }
  }

  return all;
}

function main() {
  const cfg = loadConfigLanguage(CONFIG_LANG_PATH);

  const bookList = readJsonIfExists(FACTORY_PATHS.BookFactory);
  const unitList = readJsonIfExists(FACTORY_PATHS.UnitFactory);
  const equipList = readJsonIfExists(FACTORY_PATHS.EquipmentFactory);

  if (!bookList || !unitList || !equipList) {
    throw new Error("필수 입력(BookFactory/UnitFactory/EquipmentFactory) 중 일부가 없습니다.");
  }

  const skillList = readJsonIfExists(FACTORY_PATHS.SkillFactory) || [];
  const talentList = readJsonIfExists(FACTORY_PATHS.TalentFactory) || [];
  const tagList = readJsonIfExists(FACTORY_PATHS.TagFactory) || [];
  const homeSkillList = readJsonIfExists(FACTORY_PATHS.HomeSkillFactory) || [];
  const cardList = readJsonIfExists(FACTORY_PATHS.CardFactory) || [];

  const listList = readJsonIfExists(FACTORY_PATHS.ListFactory) || [];
  const breakthroughList = readJsonIfExists(FACTORY_PATHS.BreakthroughFactory) || [];
  const growthList = readJsonIfExists(FACTORY_PATHS.GrowthFactory) || [];

  const unitById = buildById(unitList);
  const equipById = buildById(equipList);
  const skillById = buildById(skillList);
  const talentById = buildById(talentList);
  const tagById = buildById(tagList);
  const homeSkillById = buildById(homeSkillList);
  const cardById = buildById(cardList);

  const listById = buildById(listList);
  const breakthroughById = buildById(breakthroughList);
  const growthById = buildById(growthList);

  // BookFactory 필터(고정)
  const unitIdSet = pickBookIdSet(bookList, "角色图鉴", "unitList");
  const equipIdSet = pickBookIdSet(bookList, "角色装备图鉴", "equipmentList");

  // -------- Unit VM --------
  const unitVm = {};
  for (const uid of unitIdSet) {
    const urecCN = unitById.get(uid) || null;
    if (!urecCN) continue;

    const urec = translateDeep(cfg, "UnitFactory", urecCN);

    // baseSkillIds from existing lists
    const baseSkillIds = new Set();
    for (const x of Array.isArray(urecCN?.skillList) ? urecCN.skillList : []) {
      const sid = safeNum(x?.skillId);
      if (sid) baseSkillIds.add(sid);
    }
    for (const x of Array.isArray(urecCN?.passiveSkillList) ? urecCN.passiveSkillList : []) {
      const sid = safeNum(x?.skillId);
      if (sid) baseSkillIds.add(sid);
    }
    const fsid = safeNum(urecCN?.finalSkill);
    if (fsid) baseSkillIds.add(fsid);

    // talent ids
    const talentIds = new Set();
    for (const x of Array.isArray(urecCN?.talentList) ? urecCN.talentList : []) {
      const tid = safeNum(x?.talentId);
      if (tid) talentIds.add(tid);
    }

    // expanded skills
    const expandedSkillIds = expandSkillIdSet(skillById, baseSkillIds, talentById, talentIds);

    // “원소 내부에 붙이기”: skillList/passiveSkillList는 각각 해당 skillId에 대해 skill 레코드 부착
    const skillListInplace = attachByIdField(urec.skillList, "skillId", "skill", skillById, cfg, "SkillFactory");
    const passiveSkillListInplace = attachByIdField(urec.passiveSkillList, "skillId", "skill", skillById, cfg, "SkillFactory");

    // finalSkill은 스칼라라서 finalSkillRec으로 붙임(요소 내부 붙일 자리가 없음)
    const finalSkillRec = (() => {
      const srecCN = fsid ? (skillById.get(fsid) || null) : null;
      return srecCN ? translateDeep(cfg, "SkillFactory", srecCN) : null;
    })();

    // talentList 원소 내부에 talent 붙이기
    const talentListInplace = attachByIdField(urec.talentList, "talentId", "talent", talentById, cfg, "TalentFactory");

    // breakthroughList 원소 내부에 breakthrough 붙이기
    const breakthroughListInplace = attachByIdField(
      urec.breakthroughList,
      "breakthroughId",
      "breakthrough",
      breakthroughById,
      cfg,
      "BreakthroughFactory"
    );

    // homeSkillList 원소 내부에 homeSkill 붙이기
    const homeSkillListInplace = attachByIdField(urec.homeSkillList, "id", "homeSkill", homeSkillById, cfg, "HomeSkillFactory");

    // tag류 “원소 내부” + sideId 스칼라
    const tagListInplace = attachByIdField(urec.tagList, "tagId", "tag", tagById, cfg, "TagFactory");
    const equipmentSlotListInplace = attachByIdField(urec.equipmentSlotList, "tagID", "tag", tagById, cfg, "TagFactory");
    const classifyListInplace = attachByIdField(urec.classifyList, "des", "tag", tagById, cfg, "TagFactory");
    const careerListInplace = attachByIdField(urec.careerList, "des", "tag", tagById, cfg, "TagFactory");

    const sideTag = (() => {
      const tid = safeNum(urecCN?.sideId);
      const trecCN = tid ? (tagById.get(tid) || null) : null;
      return trecCN ? translateDeep(cfg, "TagFactory", trecCN) : null;
    })();

    // (선택) skills 확장셋(expandedSkillIds)에 포함된 스킬들이 “어디서 왔는지” 추적이 필요하면
    // 원본 스킬 레코드 자체에 ExSkillList/cardID 등이 들어있으니, 위에 붙인 skill 객체만 봐도 됨.
    // 여기서는 추가 파생/요약을 만들지 않음.

    unitVm[String(uid)] = {
      ...urec,

      // 기존 필드 유지 + 인라인 조인만 반영(요청 형태)
      skillList: skillListInplace,
      passiveSkillList: passiveSkillListInplace,
      finalSkillRec,

      talentList: talentListInplace,
      breakthroughList: breakthroughListInplace,
      homeSkillList: homeSkillListInplace,

      tagList: tagListInplace,
      equipmentSlotList: equipmentSlotListInplace,
      classifyList: classifyListInplace,
      careerList: careerListInplace,
      sideTag,

      // 참고: expandedSkillIds 자체를 출력하지 않음(파생/요약으로 오해될 수 있어 제외)
      // 필요하면 여기서만 임시로 출력해도 됨.
    };
  }

  // -------- Equip VM --------
  const equipVm = {};
  for (const eid of equipIdSet) {
    const erecCN = equipById.get(eid) || null;
    if (!erecCN) continue;

    const erec = translateDeep(cfg, "EquipmentFactory", erecCN);

    // skillList/disappearSkillList 원소 내부에 skill 붙이기
    const skillListInplace = attachByIdField(erec.skillList, "skillId", "skill", skillById, cfg, "SkillFactory");
    const disappearSkillListInplace = attachByIdField(erec.disappearSkillList, "skillId", "skill", skillById, cfg, "SkillFactory");

    // randomSkillList: 원소 내부에 list + (list에서 뽑힌 skills) 붙이기
    const randomSkillListCN = Array.isArray(erecCN?.randomSkillList) ? erecCN.randomSkillList : [];
    const randomSkillListInplace = [];

    // baseSkillIds: equip 자체 스킬 + random list에서 파생된 스킬까지 포함(ExSkill 확장용)
    const baseSkillIds = new Set();
    for (const x of Array.isArray(erecCN?.skillList) ? erecCN.skillList : []) {
      const sid = safeNum(x?.skillId);
      if (sid) baseSkillIds.add(sid);
    }
    for (const x of Array.isArray(erecCN?.disappearSkillList) ? erecCN.disappearSkillList : []) {
      const sid = safeNum(x?.skillId);
      if (sid) baseSkillIds.add(sid);
    }

    for (const it of randomSkillListCN) {
      const listId = safeNum(it?.skillId);
      const listRecCN = listId ? (listById.get(listId) || null) : null;

      const derivedSkillIds = pickSkillIdsFromListRecLoose(listRecCN);
      for (const sid of derivedSkillIds) {
        const n = safeNum(sid);
        if (n) baseSkillIds.add(n);
      }

      randomSkillListInplace.push({
        ...translateDeep(cfg, "EquipmentFactory", it), // 원소 자체도 번역(문자열 필드가 있다면)
        list: listRecCN ? translateDeep(cfg, "ListFactory", listRecCN) : null,
        skills: derivedSkillIds
          .map((sid) => {
            const n = safeNum(sid);
            if (!n) return null;
            const srecCN = skillById.get(n) || null;
            return srecCN ? translateDeep(cfg, "SkillFactory", srecCN) : null;
          })
          .filter(Boolean),
      });
    }

    // equip의 ExSkill 확장까지 포함된 “검증 범위”를 맞추려면 baseSkillIds를 확장해둬야 함
    const expandedSkillIds = expandSkillIdSet(skillById, baseSkillIds, null, null);

    // 그런데 “원소 내부에 붙이는 방식”만 요구했으니,
    // expandedSkillIds 전체를 따로 출력하진 않음.
    // (필요하면: randomSkillListInplace[*].skills 내부 skill 레코드에 ExSkillList가 포함돼서 확인 가능)

    // equipTagId/campTagId 스칼라 조인
    const equipTagId = safeNum(erecCN?.equipTagId);
    const campTagId = safeNum(erecCN?.campTagId);

    const equipTag = equipTagId ? translateDeep(cfg, "TagFactory", tagById.get(equipTagId) || null) : null;
    const campTag = campTagId ? translateDeep(cfg, "TagFactory", tagById.get(campTagId) || null) : null;

    // growthId 스칼라 조인
    const growthId = safeNum(erecCN?.growthId);
    const growth = growthId ? translateDeep(cfg, "GrowthFactory", growthById.get(growthId) || null) : null;

    equipVm[String(eid)] = {
      ...erec,

      skillList: skillListInplace,
      disappearSkillList: disappearSkillListInplace,
      randomSkillList: randomSkillListInplace,

      equipTag,
      campTag,
      growth,

      // cards/tags를 “별도 배열로 새로 만들기”는 지금 요청 범위 밖이라 생략
      // (원하면 다음 단계에서 SkillFactory.cardID도 같은 방식으로 “skill 안에 card” 붙이는 형태로 가능)
    };
  }

  writeJsonPretty(OUT_PATHS.UnitVM, unitVm);
  writeJsonPretty(OUT_PATHS.EquipVM, equipVm);

  console.log("[ok] wrote", path.relative(ROOT, OUT_PATHS.UnitVM));
  console.log("[ok] wrote", path.relative(ROOT, OUT_PATHS.EquipVM));
  console.log("[info] units:", Object.keys(unitVm).length, "equips:", Object.keys(equipVm).length);
}

main();
