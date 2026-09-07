import type { Grade, Subject, PublishedQuestion } from "@labs/quiz-engine/runtime";

/** 발행된 학년 파일 하나의 모양 (content/published/<grade>.json) */
export type GradeBundle = {
  grade: Grade;
  count: number;
  subjects: Subject[];
  questions: PublishedQuestion[];
};

/** content/published/index.json */
export type ContentIndex = {
  generatedAt: string;
  grades: Array<{
    grade: Grade;
    count: number;
    subjects: Subject[];
    file: string;
  }>;
};

/**
 * 문제를 어디서 가져오는가.
 *
 * 지금은 빌드에 포함된 JSON 을 읽지만, 문제가 학년당 수백 개를 넘으면
 * 번들이 커져 서버 조회로 바꿔야 한다 (DECISIONS D36).
 * 그때 이 인터페이스의 구현만 갈아끼우고 화면 코드는 건드리지 않는다.
 */
export type QuestionSource = {
  /** 어떤 학년 데이터가 준비돼 있는가 */
  listGrades(): Promise<ContentIndex["grades"]>;
  /** 한 학년의 문제 전부. 없는 학년이면 null */
  loadGrade(grade: Grade): Promise<GradeBundle | null>;
};
