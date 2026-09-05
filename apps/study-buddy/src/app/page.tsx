export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div
        aria-hidden
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600"
      >
        <div className="flex h-12 w-12 flex-col justify-center gap-1.5 rounded-lg bg-white p-2">
          <span className="h-1 w-full rounded-full bg-indigo-600" />
          <span className="h-1 w-4/5 rounded-full bg-indigo-200" />
          <span className="h-1 w-3/5 rounded-full bg-indigo-200" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">스터디버디</h1>
        <p className="text-sm text-black/60 dark:text-white/60">하루 5문제, 3분이면 끝나요</p>
      </div>

      <p className="max-w-xs text-xs leading-relaxed text-black/40 dark:text-white/40">
        아직 준비 중입니다.
        <br />
        국어 · 사회 · 과학 문제를 만들고 있어요.
      </p>
    </main>
  );
}
