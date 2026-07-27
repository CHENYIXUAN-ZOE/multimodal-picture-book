import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { paths } from "./config";

const palettes = [
  ["#705CF6", "#F29B72", "#FFF5D9"],
  ["#1AAE9F", "#F6C453", "#EDFDF8"],
  ["#E75B8D", "#7EC8E3", "#FFF0F5"],
  ["#5D7BEF", "#73D2A7", "#EEF3FF"],
  ["#ED7B45", "#9B7EDE", "#FFF3E8"],
];

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (character) => {
    const map: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return map[character];
  });

export async function createPlaceholder(input: {
  projectId: string;
  contentType: "science" | "story";
  pageIndex: number;
  topic: string;
  title: string;
}) {
  const seed = [...input.topic].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const [primary, accent, paper] = palettes[(seed + input.pageIndex) % palettes.length];
  const relativeDirectory = path.join("projects", input.projectId, input.contentType);
  const absoluteDirectory = path.join(paths.storage, relativeDirectory);
  fs.mkdirSync(absoluteDirectory, { recursive: true });
  const fileName = `page_${String(input.pageIndex).padStart(3, "0")}_placeholder.png`;
  const absolutePath = path.join(absoluteDirectory, fileName);

  const pageLabel = input.contentType === "science" ? "科普篇" : "故事篇";
  const safeTopic = escapeXml(input.topic.slice(0, 16));
  const safeTitle = escapeXml(input.title.slice(0, 20));

  const svg = `
    <svg width="900" height="1350" viewBox="0 0 900 1350" xmlns="http://www.w3.org/2000/svg">
      <rect width="900" height="1350" rx="0" fill="${paper}"/>
      <circle cx="130" cy="140" r="250" fill="${accent}" opacity="0.38"/>
      <circle cx="790" cy="300" r="310" fill="${primary}" opacity="0.22"/>
      <path d="M0 980 C180 820 310 1100 470 925 C610 770 730 840 900 690 L900 1350 L0 1350 Z" fill="${primary}" opacity="0.92"/>
      <path d="M0 1100 C180 970 320 1220 500 1040 C650 890 790 980 900 900 L900 1350 L0 1350 Z" fill="${accent}" opacity="0.85"/>
      <g transform="translate(450 540)">
        <ellipse cx="0" cy="150" rx="180" ry="150" fill="#FFFFFF" opacity="0.96"/>
        <circle cx="-92" cy="5" r="72" fill="${primary}"/>
        <circle cx="92" cy="5" r="72" fill="${accent}"/>
        <circle cx="0" cy="70" r="138" fill="#FFFFFF"/>
        <circle cx="-48" cy="62" r="18" fill="#26223A"/>
        <circle cx="48" cy="62" r="18" fill="#26223A"/>
        <path d="M-48 118 Q0 158 48 118" fill="none" stroke="#26223A" stroke-width="13" stroke-linecap="round"/>
        <circle cx="-70" cy="108" r="22" fill="#F7A0AE" opacity="0.55"/>
        <circle cx="70" cy="108" r="22" fill="#F7A0AE" opacity="0.55"/>
      </g>
      <rect x="70" y="70" width="170" height="58" rx="29" fill="#FFFFFF" opacity="0.92"/>
      <text x="155" y="108" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="26" font-weight="700" fill="#302B48">${pageLabel}</text>
      <text x="450" y="890" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="38" font-weight="800" fill="#302B48">${safeTopic}</text>
      <text x="450" y="944" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="26" font-weight="600" fill="#5E5874">${safeTitle}</text>
      <text x="450" y="1280" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="23" font-weight="600" fill="#FFFFFF">本地安全占位图 · 可上传替换</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(absolutePath);
  return path.posix.join(relativeDirectory.split(path.sep).join("/"), fileName);
}
