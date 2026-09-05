# labs

개인 프로젝트 모노레포. 회사 업무와 **완전히 분리**된 환경입니다.

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

### 2. 패키지 매니저는 pnpm 전용

```bash
nvm use          # .nvmrc → Node 22 (필수. Node 20에는 pnpm 이 없다)
pnpm install
```

`npm install` / `yarn` 을 쓰지 말 것. `packageManager` 필드로 pnpm 11.25.0 고정.

### 3. 새 패키지를 만들 때 (실측으로 확인된 제약)

**`package.json` 에 `"type": "module"` 필수**
없으면 `export` 문에서 `TS1287` 발생 (`verbatimModuleSyntax` + `NodeNext` 조합).

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

### 4. 시크릿은 레포 밖으로 나가지 않는다

- 실제 키는 `.env.local` (gitignore 됨). 전역 환경변수로 내보내지 말 것
- 커밋하는 건 `.env.example` (키 이름만, 값 없음)
- 운영 값은 Vercel 대시보드에 등록

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
