import { type AuthoredQuestion } from "./question.js";

/**
 * 근거 대조(외부 자료 확인)가 필요한 문제를 골라낸다.
 *
 * 교차 검증(정답을 가리고 다시 풀기)은 정답 인덱스 오류만 잡는다.
 * 같은 모델이 만들고 검증하면 같은 오해가 그대로 통과하기 때문이다. (DECISIONS D29)
 * 사실 오류를 잡으려면 외부 근거가 필요한데, 전부 검색하면 비용이 크다.
 * 그래서 **틀리면 위험하거나 사실 확인이 필요한 것**만 선별한다.
 */
export type RiskSignal = {
  kind: "safety" | "number" | "absolute" | "definition";
  label: string;
  hits: string[];
};

export type RiskAssessment = {
  id: string;
  /** 높을수록 근거 대조가 급하다 */
  score: number;
  signals: RiskSignal[];
};

/** 틀리면 실제 위험으로 이어지는 주제 */
const SAFETY_TERMS = [
  "불", "화재", "연소", "소화", "발화", "인화", "폭발", "화상",
  "전기", "감전", "콘센트", "플러그", "누전", "합선",
  "약품", "산성", "염기성", "독", "위험", "안전", "응급",
  "기름", "가스", "칼", "뜨거", "데다", "덴 ", "화상",
];
// 한 글자 용어는 쓰지 않는다. "데" 를 넣었더니 "~하는 데 걸리는", "데워집니다" 에
// 걸려 관련 없는 문항이 올라왔다. 짧은 용어는 반드시 실제 데이터로 확인할 것.

/** 수치는 틀리기 쉽고 확인이 필요하다 */
const NUMBER_RE = /\d+\s*(일|시간|분|초|년|개월|도|℃|%|배|미터|m|cm|km|g|kg|L|밀리|번|개|가지)/g;

/** 단정 표현은 반례가 있기 쉽다 */
const ABSOLUTE_TERMS = ["항상", "반드시", "절대", "모두", "전혀", "결코", "무조건", "언제나"];

/** 정의·원리를 규정하는 서술 */
const DEFINITION_RE = /(라고 한다|라고 하며|이라고 한다|을 뜻한다|를 뜻한다|이란|라 부른다)/g;

function collect(text: string, terms: string[]): string[] {
  return [...new Set(terms.filter((t) => text.includes(t)))];
}

export function assessRisk(q: AuthoredQuestion): RiskAssessment {
  // 지문·선택지·해설을 전부 본다. 해설의 오류가 가장 위험하다.
  const text = [q.stem, ...q.choices, q.explanation, ...q.choiceExplanations].join(" ");
  const signals: RiskSignal[] = [];

  const safety = collect(text, SAFETY_TERMS);
  if (safety.length) {
    signals.push({ kind: "safety", label: "안전 관련 주제", hits: safety });
  }

  const numbers = [...new Set(text.match(NUMBER_RE) ?? [])];
  if (numbers.length) {
    signals.push({ kind: "number", label: "수치가 등장", hits: numbers });
  }

  const absolutes = collect(text, ABSOLUTE_TERMS);
  if (absolutes.length) {
    signals.push({ kind: "absolute", label: "단정 표현", hits: absolutes });
  }

  const defs = [...new Set(text.match(DEFINITION_RE) ?? [])];
  if (defs.length) {
    signals.push({ kind: "definition", label: "정의·원리 서술", hits: defs });
  }

  // 안전은 다른 것보다 무겁게 본다 — 틀리면 아이가 위험해진다
  const WEIGHT = { safety: 3, number: 2, definition: 1, absolute: 1 } as const;
  const score = signals.reduce((s, sig) => s + WEIGHT[sig.kind] * Math.min(sig.hits.length, 3), 0);

  return { id: q.id, score, signals };
}

/** 근거 대조가 필요한 문제만, 위험도 순으로 */
export function needsFactCheck(
  questions: AuthoredQuestion[],
  minScore = 3,
): RiskAssessment[] {
  return questions
    .map(assessRisk)
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
