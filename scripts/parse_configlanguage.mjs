// parse_configlanguage.mjs
// Node.js 18+ 권장
// 실행: node parse_configlanguage.mjs

import fs from "fs";
import path from "path";

/*
 * ===== 설정 =====
 * BASE_DIR 아래에 다음 구조가 있다고 가정:
 *   BASE_DIR/{lang}/Config/ConfigLanguage.bin
 *
 * 출력은:
 *   BASE_DIR/{lang}/ConfigLanguage.json
 *
 * CN은 bin이 없어도 항상 생성:
 *   KR/Config/ConfigLanguage.bin 을 읽어서
 *   BASE_DIR/CN/ConfigLanguage.json 으로 cn->cn 저장
 */

// KR

const LANG_CONFIGS = {
  KR: {
    inputDir: "D:/Resonance/レゾナンス：無限号列車_Data/Patch/Translate",
  },
  JP: {
    inputDir: "D:/Resonance/レゾナンス：無限号列車_Data/Patch/Translate",
  },
  EN: {
    inputDir: "D:/Resonance/レゾナンス：無限号列車_Data/Patch/Translate",
  },
};

const LANGS = Object.keys(LANG_CONFIGS);
const OUTPUT_DIR = "./public/db";

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getInputPath(lang) {
  const cfg = LANG_CONFIGS[lang];
  if (!cfg || !cfg.inputDir) {
    throw new Error(`No inputDir configured for lang=${lang}`);
  }

  return path.resolve(cfg.inputDir, lang, "Config", "ConfigLanguage.bin");
}

function getOutputPath(lang) {
  // {lang}\ConfigLanguage.json
  return path.resolve(OUTPUT_DIR, lang, "ConfigLanguage.json");
}

function readU16LE(buf, off) {
  if (off + 2 > buf.length) throw new Error("readU16 out of range");
  return buf.readUInt16LE(off);
}

function readU32LE(buf, off) {
  if (off + 4 > buf.length) throw new Error("readU32 out of range");
  return buf.readUInt32LE(off);
}

function readUtf8(buf, off, len) {
  if (len < 0) throw new Error("negative len");
  if (off + len > buf.length) throw new Error("readUtf8 out of range");
  return buf.toString("utf8", off, off + len);
}

function readLenStringU16(buf, off) {
  const len = readU16LE(buf, off);
  off += 2;

  const s = readUtf8(buf, off, len);
  off += len;

  return { s, off, len };
}

function looksLikeFactoryName(s) {
  if (!s) return false;
  if (s.length < 3 || s.length > 80) return false;
  if (!/Factory$/.test(s)) return false;
  return true;
}

function findFirstFactoryOffset(buf) {
  for (let off = 0; off + 2 < buf.length; off += 1) {
    const len = buf.readUInt16LE(off);
    if (len <= 0 || len > 200) continue;

    const strOff = off + 2;
    if (strOff + len > buf.length) continue;

    const s = buf.toString("utf8", strOff, strOff + len);
    if (looksLikeFactoryName(s)) {
      return off;
    }
  }
  throw new Error("Failed to find first factory block offset");
}

/*
 * mode:
 * - "lang": out[factory][field][cn] = langText
 * - "cn"  : out[factory][field][cn] = cnText (CN bin 없을 때 생성용)
 */
function parseConfigLanguageBin(buf, mode) {
  let off = findFirstFactoryOffset(buf);

  const out = {}; // out[factory][field][cn] = text

  while (off < buf.length) {
    if (off + 2 > buf.length) break;

    const factoryLen = readU16LE(buf, off);
    if (factoryLen === 0 || factoryLen > 500) break;

    const factoryName = readUtf8(buf, off + 2, factoryLen);

    if (!looksLikeFactoryName(factoryName)) {
      break;
    }

    off += 2 + factoryLen;

    if (off + 4 > buf.length) break;

    const blockSize = readU32LE(buf, off);
    off += 4;

    const blockEnd = off + blockSize;
    if (blockEnd > buf.length) {
      throw new Error(
        `Factory block overflow: ${factoryName}, off=${off}, blockSize=${blockSize}`
      );
    }

    let boff = off;
    const fieldCount = readU32LE(buf, boff);
    boff += 4;

    if (!out[factoryName]) out[factoryName] = {};

    for (let fi = 0; fi < fieldCount; fi += 1) {
      const fieldRes = readLenStringU16(buf, boff);
      const fieldName = fieldRes.s;
      boff = fieldRes.off;

      const valueCount = readU32LE(buf, boff);
      boff += 4;

      if (!out[factoryName][fieldName]) {
        out[factoryName][fieldName] = {};
      }

      for (let vi = 0; vi < valueCount; vi += 1) {
        const cnLen = readU16LE(buf, boff);
        boff += 2;

        const cnText = readUtf8(buf, boff, cnLen);
        boff += cnLen;

        const langLen = readU16LE(buf, boff);
        boff += 2;

        const langText = readUtf8(buf, boff, langLen);
        boff += langLen;

        const text = mode === "cn" ? cnText : langText;

        // cn 중복 시 "첫 값 우선"
        if (out[factoryName][fieldName][cnText] === undefined) {
          out[factoryName][fieldName][cnText] = text;
        }
      }
    }

    off = blockEnd;
  }

  return out;
}

function writeJson(filePath, obj) {
  ensureDirForFile(filePath);
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function convertLang(lang) {
  const inputPath = getInputPath(lang);
  const outputPath = getOutputPath(lang);

  if (!fs.existsSync(inputPath)) {
    console.error(`[SKIP] not found: ${inputPath}`);
    return false;
  }

  const buf = fs.readFileSync(inputPath);
  const data = parseConfigLanguageBin(buf, "lang");
  writeJson(outputPath, data);

  console.log(`[OK] ${lang}`);
  console.log("  Input :", inputPath);
  console.log("  Output:", outputPath);

  return true;
}

function main() {
  for (const lang of LANGS) {
    convertLang(lang);
  }
}

main();
