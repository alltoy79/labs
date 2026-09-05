# 결정 기록

이 레포의 규칙(`CLAUDE.md`)을 그렇게 정한 근거와 실측 결과.
**새로운 제약·함정을 발견하면 여기에 먼저 기록하고 넘어간다.** 원복 비용이 기록 비용보다 훨씬 크다.

형식: `결정 / 근거 / 실측` — 실측이 없는 항목은 추측이므로 그렇게 표시한다.

---

## 2026-09-04

### D1. 레포 위치는 `~/itsme/project/labs`

**결정** 홈 최상위 `~/itsme/` 아래. `~/Documents` 아래에 두지 않는다.
**근거** iCloud "데스크탑 및 문서" 동기화 대상은 `~/Desktop` 과 `~/Documents` 뿐이다. 동기화 폴더에 git 레포를 두면 "저장 공간 최적화"가 `.git` 객체를 로컬에서 내려 레포가 깨진다. 지금은 iCloud 가 꺼져 있지만 나중에 켤 가능성이 있어 애초에 대상 밖에 둔다.
**실측** iCloud Drive 비활성 확인. 홈 최상위는 iCloud 동기화 대상이 아님.

### D2. git 아이덴티티를 경로 조건부로 분리

**결정** 전역 `~/.gitconfig` 는 회사 이메일 유지. `[includeIf "gitdir:~/itsme/"]` 로 `~/.gitconfig-personal` 을 추가 적용.
**근거** 개인 커밋에 회사 이메일(`@kakaocorp.com`)이 박히면 GitHub 에 노출되고, 나중에 고치려면 히스토리 재작성이 필요하다.
**실측** 4개 시나리오 테스트 전부 통과 — 회사 레포는 회사 이메일 유지, `~/itsme/` 하위는 개인 아이덴티티, `~/temp` 등 그 밖은 누출 없음, 실제 커밋 작성자도 경로에 따라 정확히 갈림.

### D3. 커밋 이름은 `alltoy79`

**결정** 개인 커밋에 회사 표기(`shaheen`)를 쓰지 않는다. 이메일은 `324830161+alltoy79@users.noreply.github.com`.
**근거** 완전 분리가 요구사항이고 레포를 다른 곳으로 이관할 가능성이 있다. GitHub noreply 형식은 실제 이메일을 숨기면서 기여 그래프에 정상 집계된다.
**실측** 계정 ID 324830161 확인 (2017년 7월 이후 가입 계정이라 숫자 접두사 형식 필요).

### D4. tsconfig 공유 설정에는 경로 옵션을 두지 않는다

**결정** `@labs/config` 의 tsconfig 에는 `outDir` / `rootDir` / `include` / `exclude` 를 넣지 않는다. 각 패키지가 직접 선언한다.
**근거·실측** TypeScript 는 `extends` 된 설정의 상대경로를 **그 파일이 있는 위치** 기준으로 해석한다. 공유 설정에 `include: ["src/**/*"]` 를 넣었더니 `packages/config/tsconfig/src/**/*` 로 풀려 `TS18003` 발생. `tsc --showConfig` 로 `outDir` 이 `../packages/config/tsconfig/dist` 로 해석되는 것까지 확인.

### D5. 모든 패키지에 `"type": "module"`

**결정** `packages/*`, `tools/*` 는 `package.json` 에 `"type": "module"` 을 넣는다.
**근거·실측** `verbatimModuleSyntax` + `module: NodeNext` 조합에서 없으면 `export` 문이 `TS1287` 로 실패. 넣으면 해소되고 strict 규칙(`noUncheckedIndexedAccess`)은 정상 동작함을 확인.
**예외** `moduleResolution: Bundler` 를 쓰는 Next.js 앱은 불필요 (`.mjs` 설정 파일로 충분).

### D6. 구조는 평면 (`apps/*`, `packages/*`, `tools/*`)

**결정** `apps/{learning,game}`, `packages/{shared,learning,game}` 같은 카테고리 층을 두지 않는다.
**근거** 게임 개발 여부를 나중에 판단하기로 했고, `packages/` 안은 정의상 전부 공유 패키지라 `shared/` 가 정보를 추가하지 않는다. 프로젝트가 5개를 넘으면 재검토한다.

### D7. 사고 기록 — `nvm install` 이 회사 기본 Node 를 바꿨다

**무슨 일** `nvm install 22` 를 실행했더니 회사 기본 Node 가 20 → 22 로 바뀌었다. `default` 별칭이 `node` → `stable` 이라는 **동적** 별칭이어서 새 버전 설치 시 따라 올라간 것.
**조치** `nvm alias default 20.20.2` 로 고정. 이제 새 Node 를 설치해도 안 움직인다.
**부작용** `default` 의 의미가 동적에서 고정으로 바뀌었다. 회사용 Node 를 올릴 때는 `nvm alias default <버전>` 을 직접 실행해야 한다.
**교훈** nvm 관련 명령 후에는 항상 `cat ~/.nvm/alias/default` 를 확인한다.

---

## 2026-09-05

### D8. 개인 레포는 공개 npm 레지스트리를 쓴다

**결정** 레포 로컬 `.npmrc` 에 `registry=https://registry.npmjs.org/`. 전역 `~/.npmrc`(사내 레지스트리 + 회사 인증 토큰)는 **무수정**.
**근거** 사내 레지스트리를 쓰면 ①VPN 없이는 설치 자체가 불가능 ②개인 프로젝트 패키지 요청이 회사 인프라에 기록 ③회사 인증 토큰 사용.
**실측** `create-next-app` 이 VPN 꺼진 상태에서 실패하며 드러남(`10.19.77.55` 로 SYN_SENT 후 멈춤). 수정 후 위치별 확인 — labs 는 공개, `~/Gargoyle` 과 홈은 사내 레지스트리 그대로. VPN 끊고 임시 store 로 설치해 `reused 0, downloaded 5` 로 실제 다운로드 성공까지 확인.

### D9. 사고 기록 — lockfile 에 회사 호스트가 박혀 GitHub 에 올라갔다

**무슨 일** 사내 레지스트리로 설치한 결과 `pnpm-lock.yaml` 의 `resolution.tarball` 에 `npm.daumkakao.io` URL 이 26곳 기록됐고 그대로 push 됐다.
**영향** 내부 호스트명 노출(Private 레포라 제한적) + 다른 기기에서 VPN 없이 설치 실패.
**조치** `.npmrc` 추가 → lockfile 재생성 → 히스토리를 커밋 1개로 재작성 → GitHub 레포 삭제·재생성 후 재push. 백업 번들 `~/itsme/labs-history-backup-*.bundle` 보관.
**함정 2개**

- lockfile 만 지우면 `node_modules/.pnpm/lock.yaml` 에서 복원된다. **`node_modules` 까지 지워야** 재해석된다. `pnpm install --force` 로도 안 된다.
- zsh 는 glob 이 매칭 안 되면 **명령 전체를 실행하지 않는다.** `rm -rf node_modules packages/*/node_modules` 에서 뒤쪽이 없으면 `rm` 이 통째로 안 돈다. 이것 때문에 진단이 한참 돌아갔다.
  **교훈** 새 개인 레포는 `.npmrc` 를 만든 **뒤** 첫 `pnpm install` 을 한다. 순서가 바뀌면 나중에 걷어내야 한다.

### D10. TypeScript 는 5.9.3 (catalog). 7.x 로 올리지 않는다

**결정** `pnpm-workspace.yaml` catalog 에 `typescript: ^5.9.3`.
**근거·실측** TS 7.0.2(네이티브 컴파일러)로 `next build` 통과, `tsc --noEmit` 통과. 그러나 **`eslint` 가 완전히 실패** — `typescript-eslint does not support TS 7.0`. typescript-eslint 8.69.0 의 지원 범위는 `>=4.8.4 <6.1.0`. lint 를 포기할 수 없으므로 5.x 유지.
**되돌리는 법** typescript-eslint 가 TS 7 을 지원하면 catalog 한 줄만 고친다. catalog 를 쓴 이유가 이것이다.

### D11. 앱은 PWA 우선, 스토어는 나중에 래핑

**결정** 네이티브 앱을 처음부터 만들지 않는다. Next.js PWA 로 만들고, 필요해지면 Android 는 TWA($25 일회성), iOS 는 Capacitor(연 $99)로 감싼다.
**근거** 필요한 기능(푸시 알림, 홈 화면 설치, 오프라인, 배지)이 전부 PWA 로 가능하다. iOS 는 16.4+ 에서 홈 화면에 추가한 PWA 에 한해 웹푸시를 지원한다.
**제약** 백그라운드 예약 작업은 불가 — 알림은 반드시 서버(크론)에서 밀어야 한다. iOS 는 홈 화면에 추가하지 않은 사이트의 저장 데이터를 7일 미사용 시 삭제하므로 학습 기록은 서버 DB 에 둔다.

### D12. 문제은행은 런타임 LLM 호출 없이 배치 생성

**결정** `tools/quiz-gen` CLI 로 미리 생성 → 자동 검증 → LLM 교차 검증 → 사람 검수 → JSON 커밋.
**근거** 교육 콘텐츠는 오답·사실오류가 치명적인데 런타임 생성은 검수할 방법이 없다. 부수적으로 비용이 사용자 수에 비례하지 않고 앱 로딩이 즉시가 된다.
**규모 제약** 초4~중3 × 3과목 = 18조합. 조합당 300문제면 5,400문제이고 문제당 30초로 검수해도 45시간이라 전량 사람 검수는 불가능. 따라서 **한 조합 50문제 파일럿으로 오류 패턴을 파악해 자동 검증 규칙을 만든 뒤 확장**한다.

### D13. 이 기기는 M4 Max 인데 셸이 Rosetta 로 돈다

**사실** `sysctl.proc_translated=1`, `uname -m` 이 `x86_64` 로 보고됨. 그래서 `nvm install 22` 가 x86_64 빌드를 받았다. 회사용 Node 20 은 arm64 네이티브다. Homebrew 도 `/usr/local`(x86).
**판단** 지금은 고치지 않는다. 기능 문제가 아니라 속도만 손해이고(dev 기동 687ms, 전체 빌드 7.2초), nvm 상태를 건드리는 명령은 D7 사고 전례가 있어 위험 대비 이득이 맞지 않는다.
**나중에 할 때** `arch -arm64` 로 Node 22 만 재설치하고, 전후로 회사 환경(특히 `~/.nvm/alias/default`)이 동일한지 검증한다. 터미널의 Rosetta 설정 자체는 건드리지 않는다 — 회사 도구가 의존할 수 있다.

### D14. Vercel 배포 — 프로젝트명 `labs-study-buddy`

**결정** Vercel Hobby(무료), 프로젝트명 `labs-study-buddy`, Root Directory `apps/study-buddy`.
**근거·실측** Vercel 이 Turborepo 를 자동 인식해 Root Directory 를 `apps/study-buddy` 로 잡아줬다(수동 설정 불필요).
프로젝트명을 `study-buddy` 로 줄이지 않은 이유 — **`study-buddy.vercel.app` 은 이미 다른 사람이 쓰고 있다**
(HTTP 200, title "Study Buddy"). Vercel 기본 도메인은 전역 네임스페이스라 선점되면 못 쓴다.
**배포 URL** https://labs-study-buddy.vercel.app (HTTP 200 확인)
**GitHub App 권한** `Only select repositories` → `labs` 만 허용. 다른 레포는 Vercel 이 볼 수 없다.
**남은 것** 앱 메타데이터가 아직 create-next-app 기본값(`<title>Create Next App</title>`)이다. PWA 설정 때 함께 고친다.

### 모노레포 배포 구조 (앞으로 앱을 추가할 때)

레포는 하나지만 **앱마다 Vercel 프로젝트를 따로 만든다.** 각 프로젝트의 Root Directory 를
`apps/<앱이름>` 으로 지정하면 도메인·환경변수·배포가 앱별로 독립된다.
커밋 하나가 여러 프로젝트 빌드를 트리거하는 게 신경 쓰이면 그때 `turbo-ignore` 를 붙인다.

## 앱 공장 (2026-09-06)

### D15. `typecheck` 는 `next typegen && tsc --noEmit`

**문제** 갓 만든 앱에서 `tsc --noEmit` 이 `error TS2304: Cannot find name 'LayoutProps'` 로 실패한다.
Next 16 이 `.next/types/` 에 생성하는 라우트 타입(`LayoutProps`, `PageProps` 등)이 없기 때문.
**해결** `next typegen` 이 전체 빌드 없이 타입만 생성한다(수 초). 앱의 `typecheck` 스크립트에 포함시켜
빌드 여부와 무관하게 항상 돌아가게 한다. `create-app` 도 생성 직후 typegen 을 실행한다.
**실측** `.next` 를 지운 상태에서 `pnpm --filter <app> typecheck` 통과 확인.
**교훈** 이건 `create-app` 을 실제로 돌려보지 않았으면 앱 2호를 만들 때 그대로 밟았을 함정이다.
생성기는 만든 뒤 반드시 실제로 실행해 검증한다.

### D16. `create-app` 은 create-next-app 을 감싸고 후처리한다

**결정** 자체 템플릿 디렉터리를 두지 않고 `create-next-app` 을 실행한 뒤 labs 규약을 입힌다.
**근거** Next 16 이 `AGENTS.md` 로 경고하듯 규약이 자주 바뀐다. 자체 템플릿은 곧 낡는다.
create-next-app 을 쓰면 최신 규약을 자동으로 따라가고, 우리는 차이(tsconfig 상속, catalog 참조,
packageManager 제거, PWA 베이스라인)만 관리한다.
**깨질 수 있는 지점** `layout.tsx` 의 metadata 블록을 정규식으로 교체한다. 템플릿이 바뀌면
스크립트가 **조용히 넘어가지 않고 실패**하도록 앵커 검사를 넣었다.
**후처리에 담긴 것** (전부 study-buddy 에서 실제로 부딪힌 것들)
앱 내 `pnpm-workspace.yaml` 제거(설정은 루트에만) / tsconfig 를 `@labs/config` 상속으로 /
`packageManager` 제거 / typescript·@types/node 를 catalog 참조로 / PWA 아이콘·manifest·메타데이터 /
`apps/registry.json` 등록 / `next typegen`.

### D17. `tools/*` 는 빌드 없는 순수 ESM JavaScript

**결정** `tools/` 의 스크립트는 `.mjs` 로 쓰고 빌드 단계를 두지 않는다. `node` 로 바로 실행된다.
**근거** 생성기·배포 스크립트는 타입 안전성보다 즉시 실행성과 단순함이 중요하다.
TS 로 쓰면 빌드나 tsx 의존성이 생기고, 그 자체가 공장 유지비가 된다.
`packages/*` 는 앱이 import 하므로 TS 를 쓴다.

### D18. 모노레포에서는 `vercel deploy --cwd` 를 쓸 수 없다

**증상** `vercel deploy --prod --cwd apps/<name>` 이
`Error: The specified Root Directory "apps/<name>" does not exist` 로 실패한다.
**원인** `--cwd` 는 그 디렉터리를 통째로 업로드하는데, 프로젝트 설정의 `rootDirectory` 가
**업로드된 것 안에서 다시** `apps/<name>` 을 찾는다. 이중 중첩.
**해결** git push 와 동일한 경로로 배포한다 — API 로 git 기반 배포를 트리거한다.

```
POST /v13/deployments
{ name, project: <prj_id>, target: "production",
  gitSource: { type: "github", repoId: <link.repoId>, ref: "main" } }
```

`repoId` 는 `GET /v9/projects/<name>` 의 `link.repoId` 에 있다.
**실측** 임시 앱 `tmp-verify` 를 만들어 프로젝트 생성 → rootDirectory PATCH →
git connect → 배포까지 전 경로를 돌리고 HTTP 200 및 배포 내용(`<title>검증용</title>`)까지 확인한 뒤 삭제.
**교훈** 평소 배포는 `git push` 로 충분하다. `deploy-app --prod` 는 즉시 배포가 필요할 때만 쓴다.

### D19. `tools/deploy` 는 멱등하다

**결정** 이미 설정된 앱에 다시 돌려도 안전하게, 각 단계가 현재 상태를 확인하고
필요할 때만 변경하도록 만들었다 (프로젝트 존재 / rootDirectory / 링크 / git 연동).
**근거** 배포 설정은 가끔 건드리는 작업이라 "지금 상태가 어떤지" 확인용으로도 쓰게 된다.
매번 새로 만들려 들면 쓸 수가 없다.
**부수 확인** Vercel 인증은 `~/Library/Application Support/com.vercel.cli` 에 저장된다 —
회사 환경과 무관. `.vercel/` 은 앱의 `.gitignore` 에 이미 포함되어 커밋되지 않는다.
**Vercel 프로젝트 삭제** `vercel project remove` 는 `--yes` 를 받지 않는다.
비대화식으로 지우려면 `vercel api -X DELETE /v9/projects/<name> --dangerously-skip-permissions`.

## 문제 스키마 (2026-09-06)

### D20. 스키마는 `packages/quiz-engine` 에 둔다

**결정** 앱보다 먼저 공유 패키지로 뺐다. "앱 1호 검증 전에 추상화하지 않는다" 원칙의 예외다.
**근거** `tools/quiz-gen`(생성)과 `apps/study-buddy`(사용)가 **오늘 둘 다 필요로 한다.**
추측이 아니라 실재하는 두 소비자가 있으므로 조기 추상화가 아니다.
단 지금은 **타입·검증만** 넣고 간격반복(SRS) 같은 도메인 로직은 실제 사용 패턴을 본 뒤 넣는다.

### D21. 스키마를 세 겹으로 나눈다

| 겹                        | 무엇                 | 왜                                                                                         |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `choiceDraftSchema`       | LLM 이 생성하는 부분 | id·검수상태·생성이력을 LLM 이 지어내면 안 된다. 순수 구조라 `z.toJSONSchema()` 로 변환된다 |
| `authoredQuestionSchema`  | 저장·검수하는 전체   | Draft + 식별자 + 검수 메타 + 생성 이력                                                     |
| `publishedQuestionSchema` | 앱 런타임 부분집합   | 검수 메타를 앱 번들에 실어보내지 않는다                                                    |

**교차 필드 규칙은 zod refine 이 아니라 `validate.ts` 에 둔다.** refine 은 JSON Schema 로
변환되지 않아 LLM 스키마를 오염시킨다.

### D22. zod 4 를 쓴다

**근거** `z.toJSONSchema()` 가 내장이라 **한 정의에서 런타임 검증과 LLM 구조화 출력 스키마를
동시에** 얻는다. `z.strictObject()` 가 `additionalProperties: false` 를 내는데, 이는 Anthropic
구조화 출력이 요구하는 형태다. 실측으로 확인함.

### D23. 학년·과목 표현

**학년** `e4 e5 e6 m1 m2 m3` — 짧고, 정렬 가능하고(`gradeOrder` 초4=4…중3=9), 학교급이 접두사로 드러난다.
**과목** `korean social history science`. **역사는 중학교부터만 허용**한다 — 초등에는 별도 역사
과목이 없고 사회에 포함된다. `subjectsFor(grade)` 와 자동 검증 규칙 `subject-allowed-for-grade` 로 강제한다.
영어·수학은 타입에 아예 없다.
**문제 id** `<학년>-<과목약어>-<4자리>` (예: `e6-sci-0001`). 사람이 읽을 수 있고 정렬되며,
자동 검증이 id 와 grade/subject 의 불일치를 잡는다.

### D24. 자동 검증 규칙 7개

사람이 수천 문제를 다 볼 수 없으므로 기계가 확실히 잡을 수 있는 것을 먼저 거른다.

`id-matches-grade-subject` / `subject-allowed-for-grade` / `choices-unique` /
`answer-not-longest`(정답만 유독 길면 내용을 몰라도 맞힌다) / `no-banned-choice`("위 모두" 류) /
`stem-no-answer-leak`(지문에 정답 노출) / `explanation-mentions-answer`(다른 문제의 해설이 붙는 것을 잡는다)

`ALL_RULE_NAMES` 와 문제의 `review.autoChecks` 를 비교하면 **규칙을 추가했을 때 재검증 대상을
식별**할 수 있다. 규칙마다 실패 케이스 테스트가 있다 (총 21개, 전부 통과).

### D25. `node --test` 에 디렉터리를 주면 안 된다

`node --test dist/__tests__/` 는 그 안의 `.d.ts` 등까지 실행하려다 실패한다.
`node --test "dist/**/*.test.js"` 처럼 파일 패턴을 명시한다.

## 문제 생성 파일럿 (2026-09-06)

### D26. 한국어에서 문자열 포함 검사는 종결어미 때문에 오탐한다

**증상** 파일럿 24문제 중 5건이 `explanation-mentions-answer` 로 실패했는데 **전부 오탐**이었다.
선택지 `"부피가 작아진다"` 와 해설 `"...부피가 작아집니다."` 는 같은 내용이지만
`String.includes` 로는 겹치지 않는다. 한국어는 어미가 바뀌면 음절 자체가 달라진다
(`작아진다` → `작아집니다`, `된다` → `됩니다`).
**해결** 어절 단위로 나눠 각 어절에서 어미를 1~2글자씩 떼어 가며 대조하고,
60% 이상 겹치면 통과시킨다. 남은 어간이 2글자 미만이면 우연히 겹칠 수 있어 버린다.
**실측** 수정 후 24문제 100% 통과. 진짜 불일치(해설이 아예 다른 내용)는 여전히 잡는다.
회귀 테스트 3케이스 추가.
**교훈** 한국어 콘텐츠에 영어식 문자열 검사를 그대로 쓰면 안 된다.
앞으로 텍스트 대조 규칙을 추가할 때마다 이 함정을 확인한다.

### D27. 세트 단위 검증이 따로 필요하다

**발견** 문제를 하나씩 보면 전부 통과하는데, 묶어 놓고 보니 두 가지가 틀어져 있었다.

- **정답 위치 편중** — 1번 6, 2번 9, 3번 6, **4번 3**. LLM 이 정답을 뒤쪽에 잘 두지 않는 경향.
- **난이도 치우침** — 프롬프트에 1:2:1 로 썼는데 실제로는 42%:38%:21% (쉬운 쪽으로 쏠림).

**해결** `runSetChecks()` 추가 — 정답 위치 분포 / 난이도 분포 / 중복 지문 / id 중복 / 단원 편중.
개별 문제 검증과 별도로 CLI 가 함께 보고한다.
**교훈** 프롬프트에 비율을 써 두는 것만으로는 지켜지지 않는다. **측정해야 한다.**
다음 배치에서는 생성 전에 "정답 위치를 1,4,2,3,... 순으로 지정" 처럼 명시하거나,
생성 후 세트 검증에 걸리면 다시 만든다.

### D28. 파일럿 규모는 24문제로 줄였다

**결정** 50문제로 계획했으나 24문제(7개 단원)로 진행했다.
**근거** 파일럿의 목적은 "어떤 오류가 나오는가" 를 아는 것이다. 실제로 24문제에서
오탐 유형 1개와 세트 단위 문제 2개를 찾았고, 이는 50문제로 늘려도 같은 발견이었을 것이다.
좁은 범위에 50개보다 **여러 단원에 24개**가 프롬프트를 더 넓게 시험한다.
검수 시간도 사용자 부담이라 짧은 주기로 도는 편이 낫다.
**남은 것** 우리 몸의 구조와 기능 / 에너지와 생활 단원은 아직 문제가 없다.
