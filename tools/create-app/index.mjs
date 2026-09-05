#!/usr/bin/env node
/**
 * labs 앱 생성기.
 *
 * create-next-app 을 그대로 쓰되(최신 Next 규약을 따라가기 위해),
 * 그 뒤에 labs 규약을 입힌다. 여기 담긴 후처리는 전부 study-buddy 를
 * 손으로 만들며 실제로 부딪힌 것들이다 — docs/DECISIONS.md 참고.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateIcons } from "@labs/icon-gen";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUBLIC_REGISTRY = "https://registry.npmjs.org/";

const log = (m) => console.log(m);
const step = (n, m) => console.log(`\n[${n}] ${m}`);
const fail = (m) => {
  console.error(`\n오류: ${m}`);
  process.exit(1);
};

// ── 인자 파싱 ────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
  console.log(`
사용: pnpm create-app <이름> [옵션]

  <이름>            앱 이름. kebab-case (예: study-buddy) → apps/<이름> 에 생성

옵션
  --title <문자열>   앱 표시 이름 (홈 화면 아이콘 아래 이름). 기본: <이름>
  --desc <문자열>    설명
  --color <hex>     테마색. 기본 #4f46e5
  --dry-run         무엇을 할지만 출력하고 실제로 만들지 않는다

예시
  pnpm create-app word-game --title "낱말게임" --desc "하루 5분 어휘 게임" --color "#0ea5e9"
`);
  process.exit(0);
}

const name = argv[0];
const flag = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const dryRun = argv.includes("--dry-run");
const title = flag("--title", name);
const desc = flag("--desc", `${title} 앱`);
const color = flag("--color", "#4f46e5");

if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  fail(`앱 이름은 kebab-case 여야 합니다: ${name}\n  예: study-buddy, word-game`);
}
if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail(`색상은 #rrggbb 형식이어야 합니다: ${color}`);

const appDir = path.join(ROOT, "apps", name);
if (fs.existsSync(appDir)) fail(`이미 존재합니다: apps/${name}`);

log(`\n앱 생성 계획`);
log(`  이름:   ${name}`);
log(`  표시명: ${title}`);
log(`  설명:   ${desc}`);
log(`  테마색: ${color}`);
log(`  경로:   apps/${name}`);
if (dryRun) {
  log(`\n--dry-run 이므로 여기서 멈춥니다.`);
  process.exit(0);
}

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });

// ── 1. create-next-app ───────────────────────────────────────
step(1, "create-next-app 실행");
run(
  "pnpm",
  [
    "dlx",
    "create-next-app@latest",
    name,
    "--ts",
    "--app",
    "--src-dir",
    "--tailwind",
    "--eslint",
    "--import-alias",
    "@/*",
    "--skip-install",
    "--use-pnpm",
    "--yes",
  ],
  {
    cwd: path.join(ROOT, "apps"),
    // pnpm dlx 는 --registry 플래그를 받지 않는다. 환경변수로 넘긴다.
    // 전역 ~/.npmrc 가 사내 레지스트리를 가리키므로 명시하지 않으면 VPN 이 필요해진다.
    env: { ...process.env, npm_config_registry: PUBLIC_REGISTRY },
  },
);

// ── 2. 앱 안의 pnpm-workspace.yaml 제거 ──────────────────────
step(2, "워크스페이스 설정 정리");
const appWs = path.join(appDir, "pnpm-workspace.yaml");
if (fs.existsSync(appWs)) {
  // create-next-app 이 allowBuilds 같은 설정을 앱 안에 만든다.
  // 워크스페이스 설정은 루트에만 있어야 하므로 내용을 루트로 합치고 지운다.
  const appYaml = fs.readFileSync(appWs, "utf8");
  const rootWsPath = path.join(ROOT, "pnpm-workspace.yaml");
  let rootYaml = fs.readFileSync(rootWsPath, "utf8");
  const newKeys = [...appYaml.matchAll(/^\s{2}([\w-]+):/gm)].map((m) => m[1]);
  const missing = newKeys.filter((k) => !rootYaml.includes(`  ${k}:`));
  if (missing.length) {
    log(`  루트로 이관할 설정: ${missing.join(", ")}`);
    for (const k of missing) {
      const line = appYaml.split("\n").find((l) => l.trim().startsWith(`${k}:`));
      if (line) rootYaml = rootYaml.trimEnd() + `\n${line}\n`;
    }
    fs.writeFileSync(rootWsPath, rootYaml);
  }
  fs.rmSync(appWs);
  log(`  제거: apps/${name}/pnpm-workspace.yaml`);
}

// ── 3. tsconfig 를 공유 설정 상속으로 ────────────────────────
step(3, "tsconfig 재배선");
// 경로가 들어가는 옵션(include/paths)은 반드시 앱에서 선언한다.
// extends 된 설정의 상대경로는 "그 파일 위치" 기준으로 해석되기 때문. (DECISIONS D4)
fs.writeFileSync(
  path.join(appDir, "tsconfig.json"),
  JSON.stringify(
    {
      extends: "@labs/config/tsconfig/nextjs.json",
      compilerOptions: { incremental: true, paths: { "@/*": ["./src/*"] } },
      include: [
        "next-env.d.ts",
        "**/*.ts",
        "**/*.tsx",
        "**/*.mts",
        ".next/types/**/*.ts",
        ".next/dev/types/**/*.ts",
      ],
      exclude: ["node_modules"],
    },
    null,
    2,
  ) + "\n",
);

// ── 4. package.json 정리 ─────────────────────────────────────
step(4, "package.json 정리");
const pkgPath = path.join(appDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
delete pkg.packageManager; // 루트에만 있어야 한다
pkg.devDependencies = {
  ...pkg.devDependencies,
  "@labs/config": "workspace:*",
  typescript: "catalog:", // TS 7 은 eslint 를 깨뜨린다 (DECISIONS D10)
  "@types/node": "catalog:",
};
pkg.devDependencies = Object.fromEntries(
  Object.keys(pkg.devDependencies)
    .sort()
    .map((k) => [k, pkg.devDependencies[k]]),
);
// next typegen 이 .next/types 를 만들어야 tsc 가 LayoutProps 등을 인식한다.
// 빌드 없이도 타입체크가 돌아가도록 스크립트에 포함시킨다. (DECISIONS D15)
pkg.scripts = { ...pkg.scripts, typecheck: "next typegen && tsc --noEmit" };
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// ── 5. PWA 아이콘 ────────────────────────────────────────────
step(5, "PWA 아이콘 생성");
for (const f of generateIcons({
  publicDir: path.join(appDir, "public"),
  appDir: path.join(appDir, "src", "app"),
  color,
})) {
  log(`  ${path.relative(ROOT, f)}`);
}

// ── 6. manifest ──────────────────────────────────────────────
step(6, "manifest 작성");
const j = (v) => JSON.stringify(v);
fs.writeFileSync(
  path.join(appDir, "src/app/manifest.ts"),
  `import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: ${j(title)},
    short_name: ${j(title)},
    description: ${j(desc)},
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: ${j(color)},
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 마크가 중앙 안전영역 안에 있어 안드로이드에서 잘려도 괜찮다
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
`,
);

// ── 7. layout 메타데이터 주입 ────────────────────────────────
step(7, "layout 메타데이터 주입");
const layoutPath = path.join(appDir, "src/app/layout.tsx");
let layout = fs.readFileSync(layoutPath, "utf8");

// 생성된 metadata 블록을 통째로 교체한다. 앵커가 없으면 조용히 넘어가지 않고 실패시킨다.
const metaRe = /export const metadata: Metadata = \{[\s\S]*?\n\};/;
if (!metaRe.test(layout)) {
  fail(
    "layout.tsx 에서 metadata 블록을 찾지 못했습니다.\n" +
      "  create-next-app 템플릿이 바뀌었을 수 있습니다. tools/create-app/index.mjs 를 갱신하세요.",
  );
}
layout = layout.replace(
  metaRe,
  `export const metadata: Metadata = {
  title: { default: ${j(title)}, template: ${j(`%s · ${title}`)} },
  description: ${j(desc)},
  applicationName: ${j(title)},
  // iOS 에서 홈 화면에 추가했을 때 전체화면으로 뜨게 한다
  appleWebApp: { capable: true, title: ${j(title)}, statusBarStyle: "default" },
  // 아직 검색 노출 단계가 아니다
  robots: { index: false, follow: false },
  other: {
    // Next 16 은 표준 태그(mobile-web-app-capable)만 출력한다.
    // iOS 16.4+ 는 manifest 의 display:standalone 을 따르지만
    // 그 이전 버전을 위해 레거시 태그를 함께 넣는다.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: ${j(color)},
  width: "device-width",
  initialScale: 1,
  // 확대를 막지 않는다 — 접근성 우선
};`,
);

if (!/import type \{[^}]*Viewport[^}]*\} from "next"/.test(layout)) {
  layout = layout.replace(
    /import type \{ Metadata \} from "next";/,
    'import type { Metadata, Viewport } from "next";',
  );
}
layout = layout.replace(/lang="en"/, 'lang="ko"');
fs.writeFileSync(layoutPath, layout);

// ── 8. 홈 화면 플레이스홀더 ──────────────────────────────────
step(8, "홈 화면 플레이스홀더 작성");
fs.writeFileSync(
  path.join(appDir, "src/app/page.tsx"),
  `export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">${title}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">${desc}</p>
      </div>
      <p className="text-xs text-black/40 dark:text-white/40">준비 중입니다.</p>
    </main>
  );
}
`,
);

// ── 9. 앱 레지스트리 ─────────────────────────────────────────
step(9, "앱 레지스트리 갱신");
const regPath = path.join(ROOT, "apps/registry.json");
const reg = fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, "utf8")) : { apps: [] };
reg.apps = reg.apps.filter((a) => a.name !== name);
reg.apps.push({
  name,
  title,
  description: desc,
  themeColor: color,
  dir: `apps/${name}`,
  createdAt: new Date().toISOString().slice(0, 10),
  vercelProject: null, // tools/deploy 가 채운다
  url: null,
});
reg.apps.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");

// ── 10. 설치 ─────────────────────────────────────────────────
step(10, "pnpm install");
run("pnpm", ["install"]);

// ── 11. 라우트 타입 생성 ─────────────────────────────────────
// 이걸 안 하면 갓 만든 앱에서 tsc 가 LayoutProps 를 못 찾아 실패한다.
step(11, "라우트 타입 생성 (next typegen)");
run("pnpm", ["--filter", name, "exec", "next", "typegen"]);

log(`
완료: apps/${name}

다음 단계
  pnpm --filter ${name} dev          # 로컬 확인
  pnpm --filter ${name} typecheck
  pnpm deploy-app ${name}            # Vercel 프로젝트 생성 + 배포
`);
