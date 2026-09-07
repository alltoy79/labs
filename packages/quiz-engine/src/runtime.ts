/**
 * 브라우저에서 쓰는 진입점.
 *
 * zod 와 node:crypto 를 끌어오지 않는다 — 앱 번들에 실리면 안 되기 때문이다.
 * 타입은 `import type` 으로 가져오면 컴파일 시 사라지므로 여기서 다시 내보낸다.
 *
 * 스키마 검증·위험도 선별·지문 id 부여는 빌드 전에 tools/quiz-gen 이 하므로
 * 앱은 런타임에 검증하지 않는다. (DECISIONS D37)
 */
export * from "./grade.js";
export * from "./subject.js";
export * from "./group.js";
export type { PublishedQuestion, AuthoredQuestion, ChoiceDraft } from "./question.js";
