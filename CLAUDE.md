# labs

**앱 개발 공장.** 여러 모바일/네이티브 앱을 같은 모노레포에서 빠르게 만들고 배포하며,
공통 배포 스크립트와 문서를 재사용하는 것이 목표다. 앱 하나를 단발성으로 만드는 곳이 아니다.

회사 업무 환경과는 **완전히 분리**되어 있다.

## 판단 기준

기능을 추가할 때 항상 묻는다: **"앱 2호를 만들 때 이걸 다시 해야 하나?"**

- 다시 해야 한다면 → `tools/` 의 생성기나 `packages/` 의 공유 패키지로 간다
- 앱마다 다를 수밖에 없다면 → 그 앱 안에 둔다

단, **앱 1호가 검증하기 전에 추상화하지 않는다.** 무엇이 공통인지 추측으로 정하면
잘못된 추상화가 나온다. 기계적 반복(스캐폴딩, 배포 설정)은 지금 자동화하고,
도메인 로직(auth / db / push / ui)은 실제 사용 패턴을 본 뒤 추출한다.

## 공장 구성 요소

| 구성 | 위치 | 상태 |
|---|---|---|
| 앱 생성기 | `tools/create-app` | — |
| 배포 스크립트 | `tools/deploy` | — |
| 앱 레지스트리 | `apps/registry.json` | — |
| 공유 설정 | `packages/config` | 있음 |
| 공유 도메인 패키지 | `packages/{ui,auth,db,push,llm}` | 앱 1호 검증 후 추출 |

## 절대 규칙

### 1. 회사 환경을 건드리지 않는다

이 레포 작업 중 다음을 **절대 수정하지 말 것**:

- 전역 `~/.gitconfig` 의 기존 항목 (회사 이메일 `@kakaocorp.com` 유지)
- `~/.zshrc`, `~/.zprofile` 등 전역 셸 설정
- nvm 기본 버전 (`default` = 20.20.2 — 회사 프로젝트용)
- **nvm 자동전환 hook을 추가하지 말 것** (회사 디렉터리에서 Node가 바뀜)
- 전역 `~/.claude/settings.json`, 전역 `~/.claude/CLAUDE.md`
- 전역 npm 패키지 설치 (`npm i -g`) — 모두 devDependency 로 넣는다

설정이 필요하면 **레포 안** 또는 **경로 조건부**(`includeIf`)로 해결한다.

**npm 레지스트리**: 전역 `~/.npmrc` 는 회사 사내 레지스트리(`npm.daumkakao.io`)와 회사 인증 토큰을 담고 있다.
이 레포는 `.npmrc` 로 공개 레지스트리를 지정해 덮어쓴다. 전역 파일은 절대 수정하지 않는다.

**nvm 주의**: `nvm install` 은 `default` 별칭을 조용히 옮길 수 있다 — 실제로 발생했다.
`default` 가 `node`→`stable` 동적 별칭이라 Node 22 설치 시 회사 기본 Node 가 20→22 로 바뀌었다.
nvm 관련 명령 후에는 **반드시 `cat ~/.nvm/alias/default` 로 `20.20.2` 인지 확인**할 것.

### 2. 패키지 매니저는 pnpm 전용

```bash
nvm use          # .nvmrc → Node 22 (필수. Node 20에는 pnpm 이 없다)
pnpm install
```

`npm install` / `yarn` 을 쓰지 말 것. `packageManager` 필드로 pnpm 11.25.0 고정
(이 필드가 없으면 turbo 가 `Could not resolve workspace` 로 실패한다).

**lockfile 오염 함정**: 사내 레지스트리로 한 번 설치하면 `pnpm-lock.yaml` 의 `resolution.tarball` 에
`npm.daumkakao.io` URL 이 박히고, 커밋되면 다른 기기에서 VPN 없이 설치가 실패한다.
기본 레지스트리에서 받은 패키지는 tarball URL 이 **기록되지 않는 것이 정상**이다.
재해석하려면 lockfile 만 지워서는 안 되고 **`node_modules` 까지 지워야** 한다
(`node_modules/.pnpm/lock.yaml` 에서 복원되며 `pnpm install --force` 로도 안 된다).

### 3. 새 패키지를 만들 때 (실측으로 확인된 제약)

**`package.json` 에 `"type": "module"` 필수**
없으면 `export` 문에서 `TS1287` 발생 (`verbatimModuleSyntax` + `NodeNext` 조합).
`moduleResolution: Bundler` 를 쓰는 Next.js 앱에는 해당하지 않는다 (`.mjs` 설정 파일로 충분).

**TypeScript 는 catalog 의 5.x 를 쓴다. 7.x 로 올리지 말 것.**
TS 7(네이티브 컴파일러)에서 `next build` 와 `tsc` 는 통과하지만 **`eslint` 가 완전히 실패**한다
(`typescript-eslint does not support TS 7.0`, 지원 범위 `>=4.8.4 <6.1.0`).
올리려면 typescript-eslint 가 TS 7 을 지원하는지 먼저 확인하고 catalog 한 줄만 고친다.

**경로 옵션은 각 패키지에서 직접 선언**
TypeScript 는 `extends` 된 설정의 상대경로를 _그 파일이 있는 위치_ 기준으로 해석한다.
`outDir` / `rootDir` / `include` / `exclude` 를 `@labs/config` 에 넣으면 안 된다.

새 패키지 템플릿:

```json
// packages/<name>/package.json
{
  "name": "@labs/<name>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": { "@labs/config": "workspace:*", "typescript": "catalog:" }
}
```

```json
// packages/<name>/tsconfig.json
{
  "extends": "@labs/config/tsconfig/node-lib.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

Next.js 앱은 `@labs/config/tsconfig/nextjs.json` 을 extends 한다.

### 4. 발견한 제약은 즉시 기록한다

조용히 잘못 동작하는 것, 원인 파악이 오래 걸린 것, 되돌리는 데 비용이 든 것을 발견하면
**다음 작업으로 넘어가기 전에** `docs/DECISIONS.md` 에 기록한다.
규칙으로 굳힐 것이면 이 파일에도 한 줄 넣는다.

기록할 것: 무슨 일이 있었는지 / 근거 / **실측 결과**(추측이면 추측이라고 명시) / 되돌리는 법.
이유: 원복 비용이 기록 비용보다 훨씬 크다. 실제로 두 번 겪었다 (DECISIONS.md D7, D9).

### 5. 시크릿은 레포 밖으로 나가지 않는다

- 실제 키는 `.env.local` (gitignore 됨). 전역 환경변수로 내보내지 말 것
- 커밋하는 건 `.env.example` (키 이름만, 값 없음)
- 운영 값은 Vercel 대시보드에 등록

## 이 기기의 특성 (성능에 영향)

- 하드웨어는 **Apple M4 Max(arm64)** 인데 셸이 **Rosetta 로 번역 실행**된다
  (`sysctl.proc_translated=1`, `uname -m` 이 `x86_64` 로 보고됨).
  회사 도구가 x86 을 요구해서로 보이며 **터미널의 Rosetta 설정은 건드리지 않는다.**
- 그래서 이 레포의 **Node 22 는 x86_64 빌드**라 번역되어 돌아간다. 회사용 Node 20 은 arm64 네이티브다.
- 기능 문제는 없고 속도만 손해다. 빌드가 답답해지면 `arch -arm64` 로 Node 22 를 재설치하되,
  전후로 `cat ~/.nvm/alias/default` 를 확인해 회사 기본 Node 가 그대로인지 검증할 것.

## Next.js 16 주의

`apps/study-buddy/AGENTS.md` 가 경고하듯 **Next.js 16 은 학습 데이터보다 최신이라 API·규약이 다를 수 있다.**
Next 관련 코드를 쓰기 전에 `apps/study-buddy/node_modules/next/dist/docs/` 의 해당 가이드를 먼저 읽을 것.

## 구조

```
apps/         배포되는 애플리케이션 (Next.js)
packages/     공유 패키지 (@labs/*)
tools/        개발용 CLI (배포되지 않음)
```

`packages/` 안은 전부 공유 패키지이므로 하위 카테고리를 두지 않는다.
프로젝트가 5개를 넘어가면 그때 카테고리를 재검토한다.

## 명령어

```bash
pnpm dev            # 전체 dev 서버
pnpm build          # 전체 빌드
pnpm typecheck      # 전체 타입체크
pnpm lint
pnpm format
pnpm --filter @labs/llm build      # 특정 패키지만
pnpm --filter study-buddy dev
```

## 커밋

Conventional Commits + 한국어 본문.

```
feat(llm): 문제 생성 프롬프트 추가
fix(quiz-engine): 간격반복 다음 출제일 계산 오류 수정
refactor: 모노레포 구조 평면화
chore(deps): turbo 2.10.12 로 업데이트
```

타입: `feat` `fix` `refactor` `chore` `docs` `test` `perf`
스코프: 패키지명(`llm`, `ui`, `quiz-engine`) 또는 앱명(`study-buddy`). 전체 범위면 생략.

## 커밋 아이덴티티

`~/itsme/` 하위에서는 자동으로 `alltoy79 <324830161+alltoy79@users.noreply.github.com>` 가 적용된다.
`git config user.email` 결과가 `@kakaocorp.com` 이면 **커밋하지 말고 원인을 먼저 알릴 것**.

## 진행 중인 프로젝트

- **study-buddy** (예정) — 초등 6학년 대상 경량 학습 PWA. 국어(어휘·한자어·독해)·사회·과학.
  영어와 수학은 범위에서 **제외**(별도의 깊이 있는 학습이 필요하다고 판단).
  하루 5문제 3~5분, 간격 반복 재출제, 부모 계정 + 아이 프로필 구조.
  문제은행은 `tools/` 의 CLI 로 **미리 배치 생성**하고 검수 후 커밋한다 — 런타임 LLM 호출을 하지 않는 것이 원칙(비용·품질·속도).
- 게임 프로젝트는 학습앱 완성 후 판단 (같은 계정을 공유할지에 따라 이 레포에 넣거나 분리)

## 관련 문서

- `SETUP.md` — 다른 기기에서 이 레포를 재현하는 절차
- `docs/DECISIONS.md` — 위 규칙들을 그렇게 정한 근거와 실측 결과
