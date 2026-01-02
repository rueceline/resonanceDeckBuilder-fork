import fs from "fs";
import path from "path";
import sharp from "sharp";

/*
 * ===== 설정 =====
 */
const INPUT_ROOT = path.resolve("public/assets");
const OUTPUT_ROOT = path.resolve("public/assets_webp");

// webp 옵션
const WEBP_OPTIONS = {
  quality: 90,        // 0~100
  effort: 4,          // 0~6 (속도/압축 트레이드오프)
};

/*
 * ===== util =====
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const abs = path.join(dir, e.name);

    if (e.isDirectory()) {
      walk(abs, files);
      continue;
    }

    if (!e.isFile()) continue;
    if (!/\.png$/i.test(e.name)) continue;

    files.push(abs);
  }

  return files;
}

/*
 * ===== main =====
 */
async function main() {
  if (!fs.existsSync(INPUT_ROOT)) {
    throw new Error(`INPUT_ROOT not found: ${INPUT_ROOT}`);
  }

  const pngFiles = walk(INPUT_ROOT);

  console.log(`PNG files: ${pngFiles.length}`);

  let converted = 0;
  let skipped = 0;

  for (const src of pngFiles) {
    const rel = path.relative(INPUT_ROOT, src);
    const relNoExt = rel.replace(/\.png$/i, "");
    const outPath = path.join(OUTPUT_ROOT, `${relNoExt}.webp`);

    if (fs.existsSync(outPath)) {
      skipped += 1;
      continue;
    }

    ensureDir(path.dirname(outPath));

    try {
      await sharp(src)
        .webp(WEBP_OPTIONS)
        .toFile(outPath);

      converted += 1;
    } catch (err) {
      console.error("[FAIL]", src);
      console.error(String(err));
    }
  }

  console.log("DONE");
  console.log("converted:", converted);
  console.log("skipped  :", skipped);
  console.log("output   :", OUTPUT_ROOT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
