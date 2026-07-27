import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readXlsxFile from "read-excel-file/node";

type Seed = {
  level1: string;
  level2: string;
  level3: string;
  chineseName: string;
  englishName: string;
  description: string;
  tags: string;
};

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const source = process.argv[2];

if (!source) {
  console.error("用法：npm run seed:subjects -- /绝对路径/主体总表.xlsx");
  process.exit(1);
}

const sourcePath = path.resolve(source);
if (!fs.existsSync(sourcePath) || !sourcePath.toLowerCase().endsWith(".xlsx")) {
  console.error("找不到指定的 .xlsx 主体总表。");
  process.exit(1);
}

const text = (value: unknown) => String(value ?? "").trim();
const subjects: Seed[] = [];
const seen = new Set<string>();
const sheets = await readXlsxFile(sourcePath);

for (const { data: rows } of sheets) {
  for (const row of rows.slice(1)) {
    const item: Seed = {
      level1: text(row[0]),
      level2: text(row[1]),
      level3: text(row[2]),
      chineseName: text(row[3]),
      englishName: text(row[4]),
      description: text(row[5]),
      tags: text(row[6]),
    };
    if (!item.chineseName) continue;
    const signature = [
      item.chineseName,
      item.level1,
      item.level2,
      item.level3,
    ].join("\u0000");
    if (seen.has(signature)) continue;
    seen.add(signature);
    subjects.push(item);
  }
}

const outputDirectory = path.join(projectRoot, "data");
const outputPath = path.join(outputDirectory, "subjects.seed.json");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(subjects, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});

console.log(`已生成 ${subjects.length.toLocaleString()} 条主体：${outputPath}`);
