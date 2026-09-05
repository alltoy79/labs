#!/usr/bin/env node
import path from "node:path";
import { generateIcons } from "./index.mjs";

const args = process.argv.slice(2);
const get = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
사용: icon-gen --app <경로> [--color #4f46e5]

  --app    Next.js 앱 디렉터리 (예: apps/study-buddy)
  --color  배경색 hex (기본 #4f46e5)

생성물: <앱>/public/icon-192.png, icon-512.png, <앱>/src/app/apple-icon.png
`);
  process.exit(0);
}

const app = get("--app");
if (!app) {
  console.error("오류: --app <경로> 가 필요합니다. --help 참고");
  process.exit(1);
}

const files = generateIcons({
  publicDir: path.join(app, "public"),
  appDir: path.join(app, "src", "app"),
  color: get("--color", "#4f46e5"),
});
for (const f of files) console.log(`  생성: ${f}`);
