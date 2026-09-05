import { type AuthoredQuestion } from "./question.js";

/**
 * 세트 단위 검증.
 *
 * 문제 하나만 보면 알 수 없고 묶음을 봐야 드러나는 문제들이다.
 * 파일럿에서 실제로 나왔다 — 정답이 4번인 문제가 유독 적었고,
 * 프롬프트에 1:2:1 로 쓴 난이도 비율이 지켜지지 않았다.
 */
export type SetCheckResult = {
  rule: string;
  passed: boolean;
  message: string;
};

/** 난이도 목표 비율 (쉬움:보통:어려움) */
const DIFFICULTY_TARGET = [0.25, 0.5, 0.25] as const;
/** 목표에서 이만큼 벗어나면 경고 */
const DIFFICULTY_TOLERANCE = 0.15;
/** 정답 위치는 각 25% 가 이상적. 이 범위를 벗어나면 경고 */
const ANSWER_POS_MIN = 0.15;
const ANSWER_POS_MAX = 0.35;

export function runSetChecks(questions: AuthoredQuestion[]): SetCheckResult[] {
  const n = questions.length;
  const results: SetCheckResult[] = [];
  if (n === 0) return results;

  // ── 정답 위치 분포 ──
  const pos = [0, 0, 0, 0];
  for (const q of questions) pos[q.answerIndex]!++;
  const posRatio = pos.map((c) => c / n);
  const posBad = posRatio
    .map((r, i) => ({ i, r }))
    .filter(({ r }) => r < ANSWER_POS_MIN || r > ANSWER_POS_MAX);
  results.push({
    rule: "answer-position-balance",
    passed: posBad.length === 0,
    message:
      posBad.length === 0
        ? `정답 위치 고름 (${pos.join(" / ")})`
        : `정답 위치 편중 (${pos.map((c, i) => `${i + 1}번 ${c}`).join(", ")}) — ` +
          posBad.map(({ i, r }) => `${i + 1}번 ${Math.round(r * 100)}%`).join(", "),
  });

  // ── 난이도 분포 ──
  const diff = [0, 0, 0];
  for (const q of questions) diff[q.difficulty - 1]!++;
  const diffRatio = diff.map((c) => c / n);
  const diffBad = diffRatio
    .map((r, i) => ({ i, r, target: DIFFICULTY_TARGET[i]! }))
    .filter(({ r, target }) => Math.abs(r - target) > DIFFICULTY_TOLERANCE);
  results.push({
    rule: "difficulty-distribution",
    passed: diffBad.length === 0,
    message:
      diffBad.length === 0
        ? `난이도 분포 적정 (${diff.join(" / ")})`
        : `난이도 분포 치우침 (쉬움 ${diff[0]}, 보통 ${diff[1]}, 어려움 ${diff[2]}) — ` +
          `목표 ${DIFFICULTY_TARGET.map((t) => Math.round(t * 100) + "%").join(":")}, ` +
          `현재 ${diffRatio.map((r) => Math.round(r * 100) + "%").join(":")}`,
  });

  // ── 문제 중복 ──
  const stems = new Map<string, string[]>();
  for (const q of questions) {
    const key = q.stem.replace(/\s+/g, "").slice(0, 40);
    stems.set(key, [...(stems.get(key) ?? []), q.id]);
  }
  const dups = [...stems.values()].filter((ids) => ids.length > 1);
  results.push({
    rule: "no-duplicate-stem",
    passed: dups.length === 0,
    message:
      dups.length === 0
        ? "중복 지문 없음"
        : `비슷한 지문: ${dups.map((ids) => ids.join("=")).join(", ")}`,
  });

  // ── id 중복 ──
  const ids = questions.map((q) => q.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  results.push({
    rule: "unique-ids",
    passed: dupIds.length === 0,
    message: dupIds.length === 0 ? "id 중복 없음" : `중복 id: ${[...new Set(dupIds)].join(", ")}`,
  });

  // ── 단원 편중 ──
  const units = new Map<string, number>();
  for (const q of questions) units.set(q.unit, (units.get(q.unit) ?? 0) + 1);
  const maxUnit = Math.max(...units.values());
  const unitSkewed = units.size > 1 && maxUnit > n * 0.4;
  results.push({
    rule: "unit-coverage",
    passed: !unitSkewed,
    message: unitSkewed
      ? `한 단원에 몰림 (${[...units.entries()].sort((a, b) => b[1] - a[1])[0]![0]}: ${maxUnit}/${n})`
      : `단원 ${units.size}개에 고르게 분포`,
  });

  return results;
}
