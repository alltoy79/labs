/**
 * 지문 묶음. 이미 부여된 passageId 로만 묶으므로 crypto 가 필요 없다 —
 * 브라우저에서도 쓸 수 있다.
 */
export type PassageGroup<Q> = {
  /** 지문이 없는 문제는 null */
  passageId: string | null;
  passage: string | null;
  questions: Q[];
};

type HasPassage = { id: string; passageId: string | null; passage: string | null };

/**
 * 지문을 공유하는 문제들을 하나로 묶는다. 입력 순서를 유지한다.
 * 지문이 없는 문제는 각각 따로 묶인다 (독립 문항).
 */
export function groupByPassage<Q extends HasPassage>(questions: Q[]): PassageGroup<Q>[] {
  const groups: PassageGroup<Q>[] = [];
  const index = new Map<string, PassageGroup<Q>>();

  for (const q of questions) {
    if (!q.passageId) {
      groups.push({ passageId: null, passage: q.passage, questions: [q] });
      continue;
    }
    const existing = index.get(q.passageId);
    if (existing) {
      existing.questions.push(q);
    } else {
      const g: PassageGroup<Q> = {
        passageId: q.passageId,
        passage: q.passage,
        questions: [q],
      };
      index.set(q.passageId, g);
      groups.push(g);
    }
  }
  return groups;
}

/** 묶음을 펼쳐 문제 배열로. 같은 지문 문제가 이어서 나온다. */
export function flattenGroups<Q>(groups: PassageGroup<Q>[]): Q[] {
  return groups.flatMap((g) => g.questions);
}

/**
 * 지문 묶음을 깨지 않고 걸러낸다.
 *
 * 지문을 공유하는 문제는 **함께 남거나 함께 빠진다.** 묶음의 일부만 남으면
 * 아이가 긴 글을 읽고 문제 하나만 푸는 셈이 되어 아깝다.
 *
 * 부수 효과를 알고 쓸 것: 난이도가 섞인 묶음은 난이도 필터에서 통째로 빠진다.
 * (예: 난이도 2와 3 문제가 한 지문을 쓰면 `difficulty: [2]` 조회에 안 잡힌다)
 * "오늘의 5문제" 처럼 난이도를 좁히지 않는 흐름에서는 문제가 없다.
 */
export function filterGroupAware<Q extends HasPassage>(
  questions: Q[],
  predicate: (q: Q) => boolean,
): Q[] {
  const groups = groupByPassage(questions);
  return flattenGroups(groups.filter((g) => g.questions.every(predicate)));
}
