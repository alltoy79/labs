import type { Grade, Subject, PublishedQuestion } from "@labs/quiz-engine/runtime";
import { filterGroupAware } from "@labs/quiz-engine/runtime";
import { staticSource } from "./static-source";
import type { QuestionSource } from "./types";

export type { GradeBundle, ContentIndex, QuestionSource } from "./types";

/** 기본 소스. 서버 조회로 바꿀 때 이 한 줄만 갈아끼운다. */
export const source: QuestionSource = staticSource;

export type QueryOptions = {
  subjects?: Subject[];
  units?: string[];
  difficulty?: Array<1 | 2 | 3>;
  /** 제외할 문제 id (이미 푼 것 등) */
  exclude?: Iterable<string>;
};

/**
 * 조건에 맞는 문제를 가져온다.
 * 지문을 공유하는 문제는 **함께 남거나 함께 빠진다** — 지문 하나에 문제가
 * 하나만 남으면 아이가 긴 글을 읽고 한 문제만 푸는 셈이 되어 아깝다.
 */
export async function queryQuestions(
  grade: Grade,
  opts: QueryOptions = {},
): Promise<PublishedQuestion[]> {
  const bundle = await source.loadGrade(grade);
  if (!bundle) return [];

  const excluded = new Set(opts.exclude ?? []);
  const matches = (q: PublishedQuestion) =>
    (!opts.subjects || opts.subjects.includes(q.subject)) &&
    (!opts.units || opts.units.includes(q.unit)) &&
    (!opts.difficulty || opts.difficulty.includes(q.difficulty as 1 | 2 | 3)) &&
    !excluded.has(q.id);

  // 지문 묶음은 함께 남거나 함께 빠진다 (규칙과 부수효과는 filterGroupAware 문서 참고)
  return filterGroupAware(bundle.questions, matches);
}

/** 학년의 전체 문제 (필터 없음) */
export async function allQuestions(grade: Grade): Promise<PublishedQuestion[]> {
  const bundle = await source.loadGrade(grade);
  return bundle?.questions ?? [];
}

/** 한 문제만 */
export async function getQuestion(
  grade: Grade,
  id: string,
): Promise<PublishedQuestion | null> {
  const bundle = await source.loadGrade(grade);
  return bundle?.questions.find((q) => q.id === id) ?? null;
}

/** 학년에 어떤 단원이 있는가 */
export async function listUnits(grade: Grade, subject?: Subject): Promise<string[]> {
  const bundle = await source.loadGrade(grade);
  if (!bundle) return [];
  const units = bundle.questions
    .filter((q) => !subject || q.subject === subject)
    .map((q) => q.unit);
  return [...new Set(units)].sort();
}
