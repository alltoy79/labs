import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  makeQuestionId,
  parseQuestionId,
  gradeOrder,
  schoolLevel,
  subjectsFor,
  isSubjectAllowed,
  authoredQuestionSchema,
  choiceDraftSchema,
  draftJsonSchema,
  toPublished,
  runAutoChecks,
  assessRisk,
  needsFactCheck,
  autoChecksPassed,
  type AuthoredQuestion,
} from "../index.js";

/** 검증용 정상 문제 */
function fixture(over: Partial<AuthoredQuestion> = {}): AuthoredQuestion {
  return {
    id: "e6-sci-0001",
    grade: "e6",
    subject: "science",
    type: "choice",
    unit: "지구와 달의 운동",
    stem: "달이 지구 주위를 한 바퀴 도는 데 걸리는 시간은 약 얼마인가요?",
    choices: ["약 7일", "약 15일", "약 30일", "약 365일"],
    answerIndex: 2,
    explanation: "달의 공전 주기는 약 30일입니다. 그래서 달의 모양도 약 한 달을 주기로 변합니다.",
    choiceExplanations: [
      "약 7일은 달의 모양이 한 단계 바뀌는 데 걸리는 시간에 가깝습니다.",
      "약 15일은 보름에서 그믐까지 걸리는 시간입니다.",
      "맞습니다. 달의 공전 주기는 약 30일입니다.",
      "약 365일은 지구가 태양 주위를 한 바퀴 도는 시간입니다.",
    ],
    difficulty: 2,
    tags: ["달", "공전"],
    standardCode: null,
    status: "draft",
    review: { autoChecks: [], crossCheck: null, factCheck: null, human: null },
    source: {
      model: "claude-opus-5",
      promptVersion: "v1",
      generatedAt: "2026-09-06T00:00:00Z",
      batchId: "b1",
    },
    ...over,
  };
}

describe("학년", () => {
  test("정렬 순서는 초4=4 … 중3=9", () => {
    assert.equal(gradeOrder("e4"), 4);
    assert.equal(gradeOrder("e6"), 6);
    assert.equal(gradeOrder("m1"), 7);
    assert.equal(gradeOrder("m3"), 9);
  });
  test("학교급 구분", () => {
    assert.equal(schoolLevel("e5"), "elementary");
    assert.equal(schoolLevel("m1"), "middle");
  });
});

describe("과목", () => {
  test("초등에는 역사가 없다", () => {
    assert.deepEqual([...subjectsFor("e6")], ["korean", "social", "science"]);
    assert.equal(isSubjectAllowed("e6", "history"), false);
  });
  test("중학교에는 역사가 있다", () => {
    assert.equal(isSubjectAllowed("m1", "history"), true);
  });
});

describe("문제 id", () => {
  test("생성과 파싱이 왕복한다", () => {
    const id = makeQuestionId("e6", "science", 1);
    assert.equal(id, "e6-sci-0001");
    assert.deepEqual(parseQuestionId(id), { grade: "e6", subject: "sci", seq: 1 });
  });
  test("범위를 벗어난 번호는 거부한다", () => {
    assert.throws(() => makeQuestionId("e6", "science", 0));
    assert.throws(() => makeQuestionId("e6", "science", 10000));
  });
  test("잘못된 id 는 null", () => {
    assert.equal(parseQuestionId("e7-sci-0001"), null);
    assert.equal(parseQuestionId("e6-mat-0001"), null);
  });
});

describe("스키마", () => {
  test("정상 문제를 통과시킨다", () => {
    assert.equal(authoredQuestionSchema.safeParse(fixture()).success, true);
  });
  test("선택지가 4개가 아니면 거부한다", () => {
    const r = authoredQuestionSchema.safeParse(fixture({ choices: ["a", "b", "c"] }));
    assert.equal(r.success, false);
  });
  test("모르는 필드를 거부한다 (strict)", () => {
    const r = authoredQuestionSchema.safeParse({ ...fixture(), 엉뚱한필드: 1 });
    assert.equal(r.success, false);
  });
  test("LLM 스키마에는 id·검수 필드가 없다", () => {
    const keys = Object.keys(choiceDraftSchema.shape);
    for (const forbidden of ["id", "status", "review", "source", "grade", "subject"]) {
      assert.equal(keys.includes(forbidden), false, `${forbidden} 이 draft 에 있으면 안 됨`);
    }
  });
  test("JSON Schema 가 additionalProperties:false 를 낸다", () => {
    const js = draftJsonSchema() as Record<string, unknown>;
    assert.equal(js["additionalProperties"], false);
    assert.ok(Array.isArray(js["required"]));
  });
  test("published 는 검수 메타를 싣지 않는다", () => {
    const p = toPublished(fixture()) as Record<string, unknown>;
    for (const k of ["status", "review", "source", "standardCode"]) {
      assert.equal(k in p, false, `${k} 가 published 에 있으면 안 됨`);
    }
    assert.equal(p["id"], "e6-sci-0001");
  });
});

describe("자동 검증", () => {
  const failed = (q: AuthoredQuestion, rule: string) => {
    const r = runAutoChecks(q).find((x) => x.rule === rule);
    if (!r) throw new Error(`${rule} 규칙이 등록되어 있지 않습니다`);
    assert.equal(r.passed, false, `${rule} 가 걸러내지 못함`);
  };

  test("정상 문제는 전부 통과", () => {
    const results = runAutoChecks(fixture());
    assert.equal(autoChecksPassed(results), true, JSON.stringify(results.filter((r) => !r.passed)));
  });
  test("중복 선택지를 잡는다", () => {
    failed(fixture({ choices: ["약 7일", "약 30일", "약 30일", "약 365일"] }), "choices-unique");
  });
  test("정답만 유독 긴 것을 잡는다", () => {
    failed(
      fixture({
        choices: [
          "7일",
          "15일",
          "약 30일이며 이 때문에 달의 모양이 한 달을 주기로 변하게 됩니다",
          "365일",
        ],
      }),
      "answer-not-longest",
    );
  });
  test("'모두 정답' 류 선택지를 잡는다", () => {
    failed(fixture({ choices: ["약 7일", "약 15일", "약 30일", "위 모두"] }), "no-banned-choice");
  });
  test("지문에 정답이 노출된 것을 잡는다", () => {
    failed(fixture({ stem: "달의 공전 주기가 약 30일인 이유로 옳은 것은?" }), "stem-no-answer-leak");
  });
  test("종결어미가 달라도 오탐하지 않는다 (한국어)", () => {
    // 파일럿에서 나온 오탐. "작아진다"(선택지) vs "작아집니다"(해설) 는
    // 단순 문자열 포함으로는 안 겹치지만 같은 내용이다.
    const cases: Array<[string[], number, string]> = [
      [["부피가 커진다", "부피가 작아진다", "그대로다", "사라진다"], 1, "압력이 커지면 기체의 부피가 작아집니다."],
      [["a", "b", "c", "전류가 흐를 때만 자석이 된다"], 3, "전자석은 전류가 흐를 때만 자석이 됩니다."],
      [["a", "b", "쓰지 않는 기구의 플러그를 뽑아 둔다", "d"], 2, "쓰지 않는 기구의 플러그를 뽑아 두는 것이 안전합니다."],
    ];
    for (const [choices, answerIndex, explanation] of cases) {
      const r = runAutoChecks(fixture({ choices, answerIndex, explanation })).find(
        (x) => x.rule === "explanation-mentions-answer",
      );
      assert.equal(r?.passed, true, `오탐: ${choices[answerIndex]} / ${explanation}`);
    }
  });

  test("해설이 정답을 언급하지 않는 것을 잡는다", () => {
    failed(fixture({ explanation: "지구는 태양 주위를 일 년에 한 바퀴 돕니다." }), "explanation-mentions-answer");
  });
  test("초등에 역사 과목을 쓰면 잡는다", () => {
    failed(
      fixture({ subject: "history", id: "e6-his-0001" }),
      "subject-allowed-for-grade",
    );
  });
  test("id 와 학년·과목 불일치를 잡는다", () => {
    failed(fixture({ id: "e5-sci-0001" }), "id-matches-grade-subject");
  });
});

describe("근거 대조 선별", () => {
  test("안전 주제를 높은 위험으로 본다", () => {
    const r = assessRisk(
      fixture({
        unit: "연소와 소화",
        stem: "기름에 붙은 불을 끌 때 물을 부으면 안 되는 까닭은?",
        explanation: "물이 수증기가 되며 기름이 튀어 화재가 번집니다. 소화기를 쓰세요.",
      }),
    );
    assert.ok(
      r.signals.some((s) => s.kind === "safety"),
      "안전 신호를 잡지 못함",
    );
    assert.ok(r.score >= 3, `위험도가 낮게 나옴: ${r.score}`);
  });

  test("수치를 신호로 잡는다", () => {
    const r = assessRisk(fixture({ explanation: "달의 공전 주기는 약 30일입니다. 그래서 약 30일마다 반복됩니다." }));
    assert.ok(r.signals.some((s) => s.kind === "number"), "수치 신호를 잡지 못함");
  });

  test("위험 신호가 없으면 선별에서 빠진다", () => {
    const plain = fixture({
      unit: "식물의 구조와 기능",
      stem: "식물의 뿌리가 하는 일이 아닌 것은?",
      choices: ["물을 흡수한다", "몸을 지지한다", "양분을 저장한다", "빛을 만든다"],
      answerIndex: 3,
      explanation: "빛을 만드는 일은 뿌리가 하지 않습니다.",
      choiceExplanations: ["뿌리는 물을 빨아들입니다.", "뿌리는 몸을 고정합니다.", "저장하는 뿌리도 있습니다.", "맞습니다. 빛을 만들지 않습니다."],
    });
    assert.equal(needsFactCheck([plain]).length, 0);
  });

  test("위험도 순으로 정렬한다", () => {
    const risky = fixture({ id: "e6-sci-0002", stem: "전기 화재가 났을 때 안전한 대처는?", explanation: "감전 위험이 있으니 물을 쓰지 않습니다. 반드시 차단기를 내립니다." });
    const mild = fixture({ id: "e6-sci-0003", explanation: "약 30일마다 반복됩니다." });
    const out = needsFactCheck([mild, risky], 1);
    assert.equal(out[0]?.id, "e6-sci-0002", "안전 주제가 먼저 와야 함");
  });
});
