#!/usr/bin/env node
/**
 * 문제은행 CLI.
 *
 * 원칙: 앱 런타임에서는 LLM 을 호출하지 않는다. 문제는 여기서 미리 만들고
 * 검증·검수한 뒤 JSON 으로 커밋한다. 교육 콘텐츠는 오답·사실오류가 치명적인데
 * 런타임 생성은 검수할 방법이 없기 때문이다. (DECISIONS D12)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  authoredQuestionSchema,
  runAutoChecks,
  autoChecksPassed,
  ALL_RULE_NAMES,
  GRADE_SHORT,
  SUBJECT_LABEL,
  runSetChecks,
} from "@labs/quiz-engine";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const log = console.log;

const usage = `
사용: pnpm quiz <명령> [인자]

  validate <파일...>   스키마 + 자동 검증 7종을 돌리고 실패 항목을 보고한다
  stats <파일...>      학년·과목·난이도·검수상태별 집계
  review <파일>        검수용으로 한 문제씩 사람이 읽기 좋게 출력
  generate             (미구현) API 키가 준비되면 여기에 붙인다

예시
  pnpm quiz validate apps/study-buddy/content/authored/*.json
  pnpm quiz stats apps/study-buddy/content/authored/*.json
  pnpm quiz review apps/study-buddy/content/authored/e6-science.json
`;

function load(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const items = Array.isArray(raw) ? raw : (raw.questions ?? []);
  return { file, items };
}

function cmdValidate(files) {
  let total = 0;
  let schemaFail = 0;
  let checkFail = 0;
  const ruleCounts = Object.fromEntries(ALL_RULE_NAMES.map((r) => [r, 0]));

  for (const file of files) {
    const { items } = load(file);
    log(`\n${path.relative(ROOT, file)} — ${items.length}문제`);
    for (const [i, item] of items.entries()) {
      total++;
      const parsed = authoredQuestionSchema.safeParse(item);
      if (!parsed.success) {
        schemaFail++;
        const issues = parsed.error.issues
          .slice(0, 3)
          .map((x) => `${x.path.join(".")}: ${x.message}`)
          .join(" / ");
        log(`  ❌ [${i}] ${item.id ?? "(id 없음)"} 스키마 위반 — ${issues}`);
        continue;
      }
      const results = runAutoChecks(parsed.data);
      if (!autoChecksPassed(results)) {
        checkFail++;
        log(`  ⚠️  ${parsed.data.id}`);
        for (const r of results.filter((x) => !x.passed)) {
          ruleCounts[r.rule]++;
          log(`      ${r.rule}: ${r.message}`);
        }
      }
    }
  }

  // 세트 단위 검증 — 문제 하나만 봐서는 알 수 없는 것들
  const allValid = files
    .flatMap((f) => load(f).items)
    .map((it) => authoredQuestionSchema.safeParse(it))
    .filter((r) => r.success)
    .map((r) => r.data);
  if (allValid.length) {
    log(`\n────────── 세트 검증 ──────────`);
    for (const r of runSetChecks(allValid)) {
      log(`  ${r.passed ? "✅" : "⚠️ "} ${r.rule}: ${r.message}`);
    }
  }

  log(`\n────────── 요약 ──────────`);
  log(`  전체:        ${total}문제`);
  log(`  스키마 위반: ${schemaFail}`);
  log(`  검증 실패:   ${checkFail}`);
  log(`  통과:        ${total - schemaFail - checkFail} (${total ? Math.round(((total - schemaFail - checkFail) / total) * 100) : 0}%)`);
  const hit = Object.entries(ruleCounts).filter(([, n]) => n > 0);
  if (hit.length) {
    log(`\n  규칙별 실패 건수`);
    for (const [rule, n] of hit.sort((a, b) => b[1] - a[1])) log(`    ${rule}: ${n}`);
  }
  return schemaFail + checkFail === 0 ? 0 : 1;
}

function cmdStats(files) {
  const by = (fn) => {
    const m = new Map();
    for (const file of files)
      for (const q of load(file).items) {
        const k = fn(q);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    return [...m.entries()].sort();
  };
  const table = (title, rows) => {
    log(`\n  ${title}`);
    for (const [k, n] of rows) log(`    ${String(k).padEnd(24)} ${n}`);
  };
  const total = files.reduce((s, f) => s + load(f).items.length, 0);
  log(`\n전체 ${total}문제`);
  table("학년", by((q) => GRADE_SHORT[q.grade] ?? q.grade));
  table("과목", by((q) => SUBJECT_LABEL[q.subject] ?? q.subject));
  table("단원", by((q) => q.unit));
  table("난이도", by((q) => `${q.difficulty} (${["", "쉬움", "보통", "어려움"][q.difficulty] ?? "?"})`));
  table("검수 상태", by((q) => q.status));
  table("정답 위치", by((q) => `${q.answerIndex + 1}번`));
  return 0;
}

function cmdReview(file) {
  const { items } = load(file);
  for (const [i, q] of items.entries()) {
    log(`\n${"─".repeat(70)}`);
    log(`[${i + 1}/${items.length}] ${q.id}  ${GRADE_SHORT[q.grade]} ${SUBJECT_LABEL[q.subject]} · ${q.unit} · 난이도 ${q.difficulty}`);
    log(`\n  ${q.stem}\n`);
    for (const [j, c] of q.choices.entries()) {
      log(`    ${j === q.answerIndex ? "▶" : " "} ${j + 1}. ${c}`);
    }
    log(`\n  해설: ${q.explanation}`);
    for (const [j, e] of (q.choiceExplanations ?? []).entries()) {
      log(`    ${j + 1}) ${e}`);
    }
  }
  log(`\n${"─".repeat(70)}\n총 ${items.length}문제`);
  return 0;
}

// ── 진입점 ───────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
const files = rest.filter((a) => !a.startsWith("-"));

if (!cmd || cmd === "--help" || cmd === "-h") {
  log(usage);
  process.exit(0);
}
if (cmd !== "generate" && files.length === 0) {
  console.error("오류: 대상 파일이 필요합니다.\n" + usage);
  process.exit(1);
}

let code = 0;
switch (cmd) {
  case "validate":
    code = cmdValidate(files);
    break;
  case "stats":
    code = cmdStats(files);
    break;
  case "review":
    code = cmdReview(files[0]);
    break;
  case "generate":
    console.error(`
generate 는 아직 구현되지 않았습니다.

파일럿 단계에서는 프롬프트(tools/quiz-gen/prompts/)를 사용해 대화로 문제를 만들고
JSON 으로 커밋한다. API 키가 준비되면 같은 프롬프트를 읽어 자동 생성하도록
여기에 호출부를 붙인다 — 프롬프트가 파일로 분리된 이유다.
`);
    code = 1;
    break;
  default:
    console.error(`알 수 없는 명령: ${cmd}\n${usage}`);
    code = 1;
}
process.exit(code);
