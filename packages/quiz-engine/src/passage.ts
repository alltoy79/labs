import { createHash } from "node:crypto";

/**
 * 지문 내용으로 안정적인 id 를 만든다.
 * 같은 지문을 쓰는 문제들이 자동으로 같은 키를 갖게 되어,
 * LLM 이 id 를 지어낼 필요가 없다.
 */
export function makePassageId(passage: string | null): string | null {
  if (!passage) return null;
  const norm = passage.replace(/\s+/g, " ").trim();
  return "p-" + createHash("sha256").update(norm).digest("hex").slice(0, 8);
}
