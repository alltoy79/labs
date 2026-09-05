#!/usr/bin/env node
/**
 * labs 배포 스크립트.
 *
 * 웹 UI 클릭 대신 CLI 로 Vercel 프로젝트를 만들고 설정한다.
 * 멱등하게 동작한다 — 이미 설정된 앱에 다시 돌려도 안전하고 현재 상태만 보고한다.
 *
 * 모노레포에서 중요한 것은 rootDirectory 다. 이 값이 apps/<name> 이어야
 * git push 시 자동 배포가 올바른 디렉터리를 빌드한다. (DECISIONS D14)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PROJECT_PREFIX = "labs-"; // Vercel 기본 도메인은 전역이라 접두사로 충돌을 줄인다

const log = (m = "") => console.log(m);
const step = (n, m) => console.log(`\n[${n}] ${m}`);
const ok = (m) => console.log(`  ✅ ${m}`);
const info = (m) => console.log(`  ${m}`);
const fail = (m) => {
  console.error(`\n오류: ${m}`);
  process.exit(1);
};

// ── 인자 ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
  log(`
사용: pnpm deploy-app <앱이름> [옵션]

  Vercel 프로젝트를 만들고 모노레포 설정(rootDirectory)과 git 연동을 맞춘다.
  이미 설정돼 있으면 현재 상태만 보고한다 (멱등).

옵션
  --prod       설정 후 즉시 프로덕션 배포. 생략하면 git push 시 자동 배포된다
  --dry-run    무엇을 할지만 출력

사전 조건
  vercel 로그인 필요:  pnpm exec vercel login
`);
  process.exit(0);
}

const name = argv[0];
const dryRun = argv.includes("--dry-run");
const doDeploy = argv.includes("--prod");

const appDir = path.join(ROOT, "apps", name);
if (!fs.existsSync(appDir)) fail(`앱을 찾을 수 없습니다: apps/${name}`);

const regPath = path.join(ROOT, "apps/registry.json");
const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
const entry = reg.apps.find((a) => a.name === name);
if (!entry) fail(`apps/registry.json 에 ${name} 이 없습니다. create-app 으로 만든 앱인가요?`);

const projectName = entry.vercelProject || `${PROJECT_PREFIX}${name}`;
const rootDirectory = `apps/${name}`;

// git 원격에서 레포 URL 을 얻는다
const gitRemote = execFileSync("git", ["remote", "get-url", "origin"], {
  cwd: ROOT,
  encoding: "utf8",
}).trim();

log(`\n배포 설정 계획`);
info(`앱:              ${name} (${entry.title})`);
info(`Vercel 프로젝트: ${projectName}`);
info(`rootDirectory:   ${rootDirectory}`);
info(`git 원격:        ${gitRemote}`);
if (dryRun) {
  log(`\n--dry-run 이므로 여기서 멈춥니다.`);
  process.exit(0);
}

// ── vercel 호출 헬퍼 ─────────────────────────────────────────
const vercel = (args, opts = {}) =>
  execFileSync("pnpm", ["exec", "vercel", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    ...opts,
  });

/** vercel api 응답에서 JSON 만 뽑는다 (CLI 가 배너를 함께 출력한다) */
const api = (args, body) => {
  let extra = [];
  let tmp;
  if (body) {
    // 중첩 객체는 -f 플래그로 못 보낸다. 임시 파일로 넘긴다.
    tmp = path.join(os.tmpdir(), `labs-deploy-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(body));
    extra = ["--input", tmp];
  }
  try {
    const out = vercel(["api", ...args, ...extra, "--raw"]);
    const m = out.match(/[[{][\s\S]*[\]}]/);
    if (!m) throw new Error(`API 응답에서 JSON 을 찾지 못했습니다:\n${out.slice(0, 300)}`);
    const j = JSON.parse(m[0]);
    if (j.error) throw new Error(`Vercel API 오류: ${j.error.code} ${j.error.message ?? ""}`);
    return j;
  } finally {
    if (tmp) fs.rmSync(tmp, { force: true });
  }
};

// ── 1. 로그인 확인 ───────────────────────────────────────────
step(1, "Vercel 로그인 확인");
let who;
try {
  who = vercel(["whoami"]).trim().split("\n").pop().trim();
} catch {
  fail("Vercel 에 로그인되어 있지 않습니다.\n  실행: pnpm exec vercel login");
}
ok(`로그인: ${who}`);

// ── 2. 프로젝트 존재 확인 / 생성 ─────────────────────────────
step(2, "Vercel 프로젝트 확인");
let project = null;
try {
  project = api([`/v9/projects/${projectName}`]);
  ok(`이미 존재: ${projectName} (${project.id})`);
} catch {
  info(`없음 → 생성합니다: ${projectName}`);
  vercel(["project", "add", projectName]);
  project = api([`/v9/projects/${projectName}`]);
  ok(`생성 완료: ${project.id}`);
}

// ── 3. rootDirectory / framework 설정 ────────────────────────
step(3, "모노레포 설정 (rootDirectory)");
const needsPatch = project.rootDirectory !== rootDirectory || project.framework !== "nextjs";
if (needsPatch) {
  info(`현재: rootDirectory=${JSON.stringify(project.rootDirectory)} framework=${project.framework}`);
  api([
    "-X",
    "PATCH",
    `/v9/projects/${projectName}`,
    "-f",
    `rootDirectory=${rootDirectory}`,
    "-f",
    "framework=nextjs",
  ]);
  project = api([`/v9/projects/${projectName}`]);
  ok(`설정: rootDirectory=${project.rootDirectory} framework=${project.framework}`);
} else {
  ok(`이미 올바름: rootDirectory=${rootDirectory} framework=nextjs`);
}

// ── 4. 로컬 디렉터리 링크 ────────────────────────────────────
step(4, "로컬 디렉터리 링크");
const linkFile = path.join(appDir, ".vercel/project.json");
if (fs.existsSync(linkFile)) {
  ok(`이미 링크됨: apps/${name}/.vercel/project.json`);
} else {
  vercel(["link", "--yes", "--project", projectName, "--cwd", appDir]);
  ok(`링크 완료 (.vercel 은 gitignore 됨)`);
}

// ── 5. git 연동 ──────────────────────────────────────────────
step(5, "git 저장소 연동");
if (project.link) {
  ok(`이미 연동됨: ${project.link.type}:${project.link.org}/${project.link.repo}`);
} else {
  info(`연동합니다: ${gitRemote}`);
  vercel(["git", "connect", gitRemote, "--yes", "--cwd", appDir]);
  project = api([`/v9/projects/${projectName}`]);
  ok(project.link ? `연동 완료: ${project.link.org}/${project.link.repo}` : "연동 결과 확인 필요");
}

// ── 6. 배포 ──────────────────────────────────────────────────
let url = entry.url;
if (doDeploy) {
  step(6, "프로덕션 배포 (git 기반)");
  // CLI 의 `vercel deploy --cwd apps/<name>` 은 모노레포에서 쓸 수 없다.
  // 그 디렉터리를 통째로 업로드하는데 프로젝트의 rootDirectory 가 업로드된 것
  // "안에서" 다시 apps/<name> 을 찾기 때문이다. (DECISIONS D18)
  // git push 와 동일한 경로가 되도록 API 로 배포를 트리거한다.
  if (!project.link) fail("git 연동이 없어 배포할 수 없습니다.");
  const ref = project.link.productionBranch ?? "main";
  info(`${project.link.org}/${project.link.repo} @ ${ref} 로 배포합니다`);
  const dep = api(["-X", "POST", "/v13/deployments"], {
    name: projectName,
    project: project.id,
    target: "production",
    gitSource: { type: project.link.type, repoId: project.link.repoId, ref },
  });
  ok(`배포 시작: ${dep.url} (${dep.readyState ?? dep.status})`);
  info(`진행 상황: pnpm exec vercel inspect ${dep.id}`);
} else {
  step(6, "배포");
  info("--prod 가 없으므로 배포하지 않습니다. git push 하면 자동 배포됩니다.");
}

// 프로덕션 도메인 (별칭) 확인
try {
  const domains = api([`/v9/projects/${projectName}/domains`]);
  const prod = (domains.domains ?? []).find((d) => !d.gitBranch);
  if (prod?.name) url = `https://${prod.name}`;
} catch {
  /* 무시 */
}

// ── 7. 레지스트리 갱신 ──────────────────────────────────────
step(7, "레지스트리 갱신");
entry.vercelProject = projectName;
entry.url = url ?? null;
fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");
ok(`apps/registry.json 갱신`);

log(`
완료: ${name}
  Vercel 프로젝트: ${projectName}
  URL:             ${url ?? "(배포 후 생성됨)"}
  자동 배포:        main 브랜치 push 시
`);
