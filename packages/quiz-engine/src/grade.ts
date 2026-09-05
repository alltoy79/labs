/** 학년. 초등 4학년 ~ 중학교 3학년. */
export const GRADES = ["e4", "e5", "e6", "m1", "m2", "m3"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABEL: Record<Grade, string> = {
  e4: "초등 4학년",
  e5: "초등 5학년",
  e6: "초등 6학년",
  m1: "중학교 1학년",
  m2: "중학교 2학년",
  m3: "중학교 3학년",
};

export const GRADE_SHORT: Record<Grade, string> = {
  e4: "초4",
  e5: "초5",
  e6: "초6",
  m1: "중1",
  m2: "중2",
  m3: "중3",
};

export type SchoolLevel = "elementary" | "middle";

export function schoolLevel(grade: Grade): SchoolLevel {
  return grade.startsWith("e") ? "elementary" : "middle";
}

/** 정렬용 순서. 초4=4 … 중3=9 */
export function gradeOrder(grade: Grade): number {
  const n = Number(grade.slice(1));
  return schoolLevel(grade) === "elementary" ? n : n + 6;
}
