import type { Grade } from "@labs/quiz-engine/runtime";
import type { ContentIndex, GradeBundle, QuestionSource } from "./types";
import indexJson from "../../../content/published/index.json";
import e6 from "../../../content/published/e6.json";

/**
 * 빌드에 포함된 JSON 을 읽는 구현.
 *
 * 정적 import 이므로 학년을 늘릴 때 이 표에 한 줄 추가한다.
 * 동적 import 로 하면 학년별로 청크가 갈리지만, 지금은 학년이 하나이고
 * 정적 import 가 타입 검사를 받으므로 더 안전하다.
 *
 * 스키마 검증은 발행 시(tools/quiz-gen)에 끝냈으므로 여기서 다시 하지 않는다 —
 * 앱 번들에 zod 를 싣지 않기 위해서다.
 */
const BUNDLES: Partial<Record<Grade, unknown>> = {
  e6,
};

export const staticSource: QuestionSource = {
  async listGrades() {
    return (indexJson as ContentIndex).grades;
  },

  async loadGrade(grade) {
    const bundle = BUNDLES[grade];
    return bundle ? (bundle as GradeBundle) : null;
  },
};
