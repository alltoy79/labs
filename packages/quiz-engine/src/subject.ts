import { type Grade, schoolLevel } from "./grade.js";

/**
 * 과목. 영어와 수학은 의도적으로 제외한다 — 그 둘은 별도의 깊이 있는 학습이
 * 필요하다는 판단이며, 이 앱은 "틈틈이 가볍게" 를 노린다.
 */
export const SUBJECTS = ["korean", "social", "history", "science"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABEL: Record<Subject, string> = {
  korean: "국어",
  social: "사회",
  history: "역사",
  science: "과학",
};

/** 문제 id 에 쓰는 약어 */
export const SUBJECT_ABBR: Record<Subject, string> = {
  korean: "kor",
  social: "soc",
  history: "his",
  science: "sci",
};

/**
 * 초등에는 별도 "역사" 과목이 없다 (사회에 포함).
 * 중학교부터 분리되므로 학년에 따라 허용 과목이 다르다.
 */
export function subjectsFor(grade: Grade): readonly Subject[] {
  return schoolLevel(grade) === "elementary"
    ? (["korean", "social", "science"] as const)
    : SUBJECTS;
}

export function isSubjectAllowed(grade: Grade, subject: Subject): boolean {
  return subjectsFor(grade).includes(subject);
}
