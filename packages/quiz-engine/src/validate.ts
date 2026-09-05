import { type AuthoredQuestion } from "./question.js";
import { isSubjectAllowed } from "./subject.js";
import { SUBJECT_ABBR } from "./subject.js";
import { parseQuestionId } from "./id.js";

/**
 * 자동 검증.
 *
 * 사람이 수천 문제를 다 볼 수는 없으므로, 기계가 확실히 잡을 수 있는 것은
 * 여기서 걸러내고 사람은 남은 것에 집중한다.
 * 규칙을 추가하면 AuthoredQuestion.review.autoChecks 와 비교해 재검증 대상을 찾을 수 있다.
 */
export type CheckResult = { rule: string; passed: boolean; message?: string };

/** 선택지에 쓰면 안 되는 표현. 초등·중등 객관식에서 변별력을 떨어뜨린다. */
const BANNED_CHOICE_PATTERNS = [/^모두\s*(정답|맞다|옳다)/, /위\s*(의\s*)?모두/, /^정답\s*없음/, /^알\s*수\s*없다/];

type Rule = { name: string; check: (q: AuthoredQuestion) => string | null };

const RULES: Rule[] = [
  {
    name: "id-matches-grade-subject",
    check: (q) => {
      const p = parseQuestionId(q.id);
      if (!p) return `id 형식이 잘못됨: ${q.id}`;
      if (p.grade !== q.grade) return `id 의 학년(${p.grade})이 grade(${q.grade})와 다름`;
      if (p.subject !== SUBJECT_ABBR[q.subject])
        return `id 의 과목(${p.subject})이 subject(${q.subject})와 다름`;
      return null;
    },
  },
  {
    name: "subject-allowed-for-grade",
    check: (q) =>
      isSubjectAllowed(q.grade, q.subject)
        ? null
        : `${q.grade} 에는 ${q.subject} 과목이 없습니다 (역사는 중학교부터)`,
  },
  {
    name: "choices-unique",
    check: (q) => {
      const norm = q.choices.map((c) => c.trim().replace(/\s+/g, " "));
      const dup = norm.find((c, i) => norm.indexOf(c) !== i);
      return dup ? `중복 선택지: "${dup}"` : null;
    },
  },
  {
    name: "answer-not-longest",
    check: (q) => {
      // 정답만 유독 길면 내용을 몰라도 맞힐 수 있다.
      const lens = q.choices.map((c) => c.length);
      const max = Math.max(...lens);
      const answerLen = lens[q.answerIndex]!;
      if (answerLen < max) return null;
      const others = lens.filter((_, i) => i !== q.answerIndex);
      const secondMax = Math.max(...others);
      // 정답이 최장이더라도 2위와 큰 차이가 없으면 통과
      return answerLen > secondMax * 1.5 && answerLen - secondMax > 10
        ? `정답 선택지가 유독 김 (정답 ${answerLen}자 vs 나머지 최대 ${secondMax}자)`
        : null;
    },
  },
  {
    name: "no-banned-choice",
    check: (q) => {
      for (const c of q.choices) {
        const hit = BANNED_CHOICE_PATTERNS.find((re) => re.test(c.trim()));
        if (hit) return `사용할 수 없는 선택지 표현: "${c}"`;
      }
      return null;
    },
  },
  {
    name: "stem-no-answer-leak",
    check: (q) => {
      const answer = q.choices[q.answerIndex]!.trim();
      // 짧은 답(숫자 등)은 우연히 겹칠 수 있으므로 4자 이상만 본다
      if (answer.length < 4) return null;
      return q.stem.includes(answer) ? `지문에 정답이 그대로 노출됨: "${answer}"` : null;
    },
  },
  {
    name: "explanation-mentions-answer",
    check: (q) => {
      // 단순 문자열 포함으로는 안 된다. 한국어는 종결어미가 바뀌면
      // "작아진다" 와 "작아집니다" 가 겹치지 않는다.
      // 어절 단위로 나눠 어미를 잘라 가며 대조하고, 60% 이상 겹치면 통과시킨다.
      const answer = q.choices[q.answerIndex]!.trim();
      if (answer.length < 2) return null;
      const tokens = answer.split(/\s+/).filter((t) => t.length >= 2);
      if (tokens.length === 0) return null;

      const matched = tokens.filter((t) => {
        if (q.explanation.includes(t)) return true;
        // 어미를 한 글자씩 떼어 본다. 남은 어간이 2글자 미만이면 우연히 겹칠 수 있어 버린다.
        for (const cut of [1, 2]) {
          const stem = t.slice(0, -cut);
          if (stem.length >= 2 && q.explanation.includes(stem)) return true;
        }
        return false;
      });

      const ratio = matched.length / tokens.length;
      return ratio >= 0.6
        ? null
        : `해설이 정답("${answer}")을 거의 언급하지 않음 (일치 ${matched.length}/${tokens.length}) — 다른 문제의 해설일 수 있음`;
    },
  },
];

export function runAutoChecks(q: AuthoredQuestion): CheckResult[] {
  return RULES.map(({ name, check }) => {
    const message = check(q);
    return message === null ? { rule: name, passed: true } : { rule: name, passed: false, message };
  });
}

export function autoChecksPassed(results: CheckResult[]): boolean {
  return results.every((r) => r.passed);
}

/** 등록된 전체 규칙 이름. 규칙을 추가했을 때 재검증 대상 식별에 쓴다. */
export const ALL_RULE_NAMES: readonly string[] = RULES.map((r) => r.name);
