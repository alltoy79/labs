import { z } from "zod";
import { GRADES } from "./grade.js";
import { SUBJECTS } from "./subject.js";

/**
 * 스키마를 세 겹으로 나눈다.
 *
 *  1. Draft      — LLM 이 생성하는 부분. 순수 구조만 있어 JSON Schema 로 변환된다.
 *                  id·검수상태·생성이력은 LLM 이 지어내면 안 되므로 포함하지 않는다.
 *  2. Authored   — 저장·검수하는 전체 형태. Draft + 식별자 + 검수 메타.
 *  3. Published  — 앱이 런타임에 쓰는 부분집합. 검수 메타를 앱에 실어보내지 않는다.
 *
 * 교차 필드 규칙(정답이 가장 길면 안 된다 등)은 여기 넣지 않고 validate.ts 에 둔다.
 * zod refine 은 JSON Schema 로 변환되지 않아 LLM 스키마를 오염시키기 때문이다.
 */

export const QUESTION_TYPES = ["choice"] as const;

/** ── 1. LLM 이 생성하는 부분 ─────────────────────────────── */
export const choiceDraftSchema = z.strictObject({
  /** 교육과정 단원명. 예: "지구와 달의 운동" */
  unit: z.string().min(2).max(60),
  /** 문제 지문 */
  stem: z.string().min(5).max(400),
  /** 선택지 4개 */
  choices: z.array(z.string().min(1).max(120)).length(4),
  /** 정답 위치 (0~3) */
  answerIndex: z.number().int().min(0).max(3),
  /** 정답 해설 */
  explanation: z.string().min(10).max(600),
  /** 선택지별 해설. 왜 그것이 답인지 / 왜 아닌지. 순서는 choices 와 같다. */
  choiceExplanations: z.array(z.string().min(5).max(300)).length(4),
  /** 1 쉬움 · 2 보통 · 3 어려움 */
  difficulty: z.number().int().min(1).max(3),
  /** 검색·분석용 키워드 */
  tags: z.array(z.string().min(1).max(20)).min(1).max(5),
});
export type ChoiceDraft = z.infer<typeof choiceDraftSchema>;

/** ── 2. 저장·검수하는 전체 형태 ──────────────────────────── */
export const reviewSchema = z.strictObject({
  /** 통과한 자동 검증 규칙 이름들. 규칙을 추가하면 재검증 대상을 여기서 식별한다. */
  autoChecks: z.array(z.string()),
  /** 정답을 숨기고 다시 풀렸을 때의 결과. 생성한 프롬프트로 자가검증하면 그냥 통과시켜버린다. */
  crossCheck: z
    .strictObject({
      passed: z.boolean(),
      model: z.string(),
      at: z.string(),
      note: z.string().optional(),
    })
    .nullable(),
  /** 외부 근거(웹 검색 등)와 대조한 결과. 교차 검증이 못 잡는 사실 오류는 이것만 잡는다. */
  factCheck: z
    .strictObject({
      passed: z.boolean(),
      /** 무엇으로 확인했는지. 예: "웹 검색", "교육부 성취기준 문서" */
      source: z.string(),
      at: z.string(),
      note: z.string().optional(),
    })
    .nullable(),
  /** 사람 검수 */
  human: z
    .strictObject({
      reviewedAt: z.string(),
      by: z.string(),
      note: z.string().optional(),
    })
    .nullable(),
});
export type Review = z.infer<typeof reviewSchema>;

export const sourceSchema = z.strictObject({
  model: z.string(),
  /** 프롬프트를 고쳤을 때 어떤 버전으로 만든 문제인지 추적한다. 품질 문제 시 일괄 재생성용. */
  promptVersion: z.string(),
  generatedAt: z.string(),
  batchId: z.string(),
});
export type Source = z.infer<typeof sourceSchema>;

export const authoredQuestionSchema = choiceDraftSchema.extend({
  /** `<학년>-<과목약어>-<4자리>` 예: e6-sci-0001 */
  id: z.string().regex(/^(e[456]|m[123])-(kor|soc|his|sci)-\d{4}$/),
  grade: z.enum(GRADES),
  subject: z.enum(SUBJECTS),
  type: z.enum(QUESTION_TYPES),
  /** 교육부 성취기준 코드. 근거 자료로 생성했을 때만 채워진다. */
  standardCode: z.string().nullable(),
  /** verified 만 앱에 나간다 */
  status: z.enum(["draft", "verified", "rejected"]),
  review: reviewSchema,
  source: sourceSchema,
});
export type AuthoredQuestion = z.infer<typeof authoredQuestionSchema>;

/** ── 3. 앱이 런타임에 쓰는 부분집합 ──────────────────────── */
export const publishedQuestionSchema = choiceDraftSchema
  .omit({ difficulty: true, tags: true })
  .extend({
    id: z.string(),
    grade: z.enum(GRADES),
    subject: z.enum(SUBJECTS),
    type: z.enum(QUESTION_TYPES),
    difficulty: z.number().int().min(1).max(3),
    tags: z.array(z.string()),
  });
export type PublishedQuestion = z.infer<typeof publishedQuestionSchema>;

/** 검수 통과분에서 앱에 실을 부분만 뽑는다 */
export function toPublished(q: AuthoredQuestion): PublishedQuestion {
  const { standardCode, status, review, source, ...rest } = q;
  return rest;
}

/** LLM 구조화 출력에 넘길 JSON Schema */
export function draftJsonSchema(): unknown {
  return z.toJSONSchema(choiceDraftSchema);
}
