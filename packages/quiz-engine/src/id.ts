import { type Grade } from "./grade.js";
import { SUBJECT_ABBR, type Subject } from "./subject.js";

/** `<학년>-<과목약어>-<4자리>` 예: makeQuestionId("e6","science",1) → "e6-sci-0001" */
export function makeQuestionId(grade: Grade, subject: Subject, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 9999) {
    throw new Error(`문제 번호는 1~9999 여야 합니다: ${seq}`);
  }
  return `${grade}-${SUBJECT_ABBR[subject]}-${String(seq).padStart(4, "0")}`;
}

export function parseQuestionId(id: string): { grade: string; subject: string; seq: number } | null {
  const m = /^(e[456]|m[123])-(kor|soc|his|sci)-(\d{4})$/.exec(id);
  if (!m) return null;
  return { grade: m[1]!, subject: m[2]!, seq: Number(m[3]) };
}
