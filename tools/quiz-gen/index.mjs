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
  needsFactCheck,
  assessRisk,
} from "@labs/quiz-engine";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const log = console.log;

const usage = `
사용: pnpm quiz <명령> [인자]

  validate <파일...>   스키마 + 자동 검증 7종 + 세트 검증 5종
  risk <파일...>       근거 대조(웹 검색)가 필요한 문제를 위험도 순으로 선별
  blind <파일>         교차 검증용 — 정답을 지운 문제 목록을 출력
  blind-apply <파일> <답안>  교차 검증 답안(JSON: {"id":정답번호})을 대조하고 기록
  stats <파일...>      학년·과목·난이도·검수상태별 집계
  review <파일>        검수용으로 한 문제씩 사람이 읽기 좋게 출력
  status <파일...>     검증 단계별 진행 상황 (구조/교차/근거/사람)
  promote <파일...> [--apply]  검증을 모두 통과한 문제를 verified 로 승격
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

function parseAll(files) {
  const out = [];
  for (const file of files)
    for (const item of load(file).items) {
      const p = authoredQuestionSchema.safeParse(item);
      if (p.success) out.push(p.data);
    }
  return out;
}

function cmdRisk(files) {
  const qs = parseAll(files);
  const risky = needsFactCheck(qs);
  const byId = new Map(qs.map((q) => [q.id, q]));

  log(`\n근거 대조 대상 ${risky.length} / 전체 ${qs.length}문제\n`);
  log("교차 검증은 정답 인덱스 오류만 잡는다. 아래는 외부 자료로 확인이 필요한 것들이다.");
  log("이미 확인한 것(review.factCheck)은 ✓ 로 표시한다.\n");

  for (const r of risky) {
    const q = byId.get(r.id);
    const done = q.review.factCheck ? "✓" : " ";
    log(`${done} [${String(r.score).padStart(2)}] ${r.id}  ${q.unit}`);
    for (const s of r.signals) {
      log(`       ${s.label}: ${s.hits.slice(0, 5).join(", ")}`);
    }
  }
  const todo = risky.filter((r) => !byId.get(r.id).review.factCheck);
  log(`\n  확인 완료 ${risky.length - todo.length} · 남음 ${todo.length}`);
  if (todo.length) log(`  프롬프트: tools/quiz-gen/prompts/factcheck.md`);
  return 0;
}

function cmdBlind(file) {
  const qs = parseAll([file]);
  log(`# 교차 검증용 문항 ${qs.length}개 — 정답이 지워져 있다\n`);
  log(`프롬프트: tools/quiz-gen/prompts/crosscheck.md\n`);
  for (const q of qs) {
    log(`${q.id} | ${q.stem}`);
    q.choices.forEach((c, i) => log(`   ${i + 1}. ${c}`));
    log("");
  }
  log(`답안을 {"${qs[0]?.id}": 1, ...} 형태 JSON 으로 저장한 뒤:`);
  log(`  pnpm quiz blind-apply ${file} <답안.json>`);
  return 0;
}

function cmdBlindApply(file, answerFile) {
  const raw = JSON.parse(fs.readFileSync(answerFile, "utf8"));
  const items = load(file).items;
  let ok = 0;
  const bad = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const item of items) {
    const given = raw[item.id];
    if (given == null) continue;
    const expected = item.answerIndex + 1;
    const passed = given === expected;
    if (passed) ok++;
    else bad.push({ id: item.id, given, expected, stem: item.stem });
    item.review = item.review ?? {};
    item.review.crossCheck = {
      passed,
      model: process.env.QUIZ_MODEL ?? "claude-opus-5",
      at: today,
      note: passed ? "정답 일치" : `불일치: 재풀이 ${given}번 vs 표기 ${expected}번`,
    };
  }
  fs.writeFileSync(file, JSON.stringify(items, null, 2) + "\n");

  log(`\n교차 검증 ${ok}/${ok + bad.length} 일치`);
  if (bad.length) {
    log(`\n불일치 — 정답 인덱스를 다시 봐야 한다`);
    for (const b of bad) log(`  ❌ ${b.id}  재풀이 ${b.given}번 vs 표기 ${b.expected}번\n     ${b.stem.slice(0, 50)}`);
  } else {
    log("  불일치 없음");
  }
  log(`\n  ${file} 에 기록함`);
  return bad.length ? 1 : 0;
}

function cmdStatus(files) {
  const qs = parseAll(files);
  const n = qs.length;
  const risky = new Set(needsFactCheck(qs).map((r) => r.id));
  const count = (fn) => qs.filter(fn).length;
  const line = (label, done, total, note = "") =>
    log(`  ${label.padEnd(14)} ${String(done).padStart(3)}/${String(total).padEnd(4)} ${"█".repeat(Math.round((done / (total || 1)) * 20)).padEnd(20, "·")} ${note}`);

  log(`\n검증 진행 상황 — ${n}문제\n`);
  line("구조 검증", count((q) => q.review.autoChecks.length > 0), n);
  line("교차 검증", count((q) => q.review.crossCheck), n);
  const fcDone = qs.filter((q) => risky.has(q.id) && q.review.factCheck).length;
  line("근거 대조", fcDone, risky.size, `위험 항목 ${risky.size}건만 대상`);
  line("사람 검수", count((q) => q.review.human), n, "선택");
  log("");
  line("검수 완료", count((q) => q.status === "verified"), n, "verified 만 앱에 나간다");
  log("");
  return 0;
}

/**
 * verified 승격 기준 — 이 조건을 모두 만족해야 앱에 나간다.
 * 기준을 코드로 박아 두어야 사람이 그때그때 판단하지 않는다.
 */
function verdictFor(q, risky) {
  if (q.review.autoChecks.length === 0) return "구조 검증 기록 없음";
  if (!runAutoChecks(q).every((r) => r.passed)) return "자동 검증 실패";
  if (!q.review.crossCheck) return "교차 검증 안 함";
  if (!q.review.crossCheck.passed) return "교차 검증 불일치";
  if (risky.has(q.id) && !q.review.factCheck) return "근거 대조 필요 (위험 항목)";
  if (risky.has(q.id) && !q.review.factCheck.passed) return "근거 대조 실패";
  return null; // 통과
}

function cmdPromote(files, apply) {
  const qs = parseAll(files);
  const risky = new Set(needsFactCheck(qs).map((r) => r.id));
  const pass = [];
  const hold = [];
  for (const q of qs) {
    const reason = verdictFor(q, risky);
    if (reason) hold.push({ id: q.id, reason });
    else pass.push(q.id);
  }

  log(`\n승격 대상 ${pass.length} / 보류 ${hold.length}\n`);
  if (hold.length) {
    log("보류 — 이유");
    const byReason = new Map();
    for (const h of hold) byReason.set(h.reason, [...(byReason.get(h.reason) ?? []), h.id]);
    for (const [reason, ids] of byReason) log(`  ${reason}: ${ids.length}건 (${ids.slice(0, 4).join(", ")}${ids.length > 4 ? " …" : ""})`);
    log("");
  }

  if (!apply) {
    log("  실제로 바꾸려면 --apply 를 붙이세요.");
    return 0;
  }

  const passSet = new Set(pass);
  let changed = 0;
  for (const file of files) {
    const items = load(file).items;
    for (const item of items) {
      if (passSet.has(item.id) && item.status !== "verified") {
        item.status = "verified";
        changed++;
      }
    }
    fs.writeFileSync(file, JSON.stringify(items, null, 2) + "\n");
  }
  log(`  ✅ ${changed}문제를 verified 로 승격`);
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
  case "risk":
    code = cmdRisk(files);
    break;
  case "blind":
    code = cmdBlind(files[0]);
    break;
  case "blind-apply":
    if (files.length < 2) {
      console.error("사용: pnpm quiz blind-apply <문항파일> <답안.json>");
      code = 1;
    } else code = cmdBlindApply(files[0], files[1]);
    break;
  case "status":
    code = cmdStatus(files);
    break;
  case "promote":
    code = cmdPromote(files, rest.includes("--apply"));
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
