# icon-gen

PWA 아이콘 생성 스크립트. **의존성 없음** (Node 내장 zlib 로 PNG 를 직접 인코딩).

이 기기에는 ImageMagick / rsvg-convert 가 없고 `sips` 는 SVG 를 다루지 못해서,
외부 도구 없이 돌아가도록 픽셀을 직접 그린다.

## 사용

```bash
cd apps/study-buddy
node ../../tools/icon-gen/gen-icon.mjs        # public/icon-192.png, icon-512.png
```

apple-touch-icon(180x180)은 스크립트의 크기 배열과 출력 경로를 바꿔 생성한 뒤
`src/app/apple-icon.png` 로 옮긴다 (Next 파일 규약).

## 현재 디자인

인디고(#4f46e5) 배경 + 흰 카드 + 가로줄 3개. **임시 플레이스홀더**이므로
제대로 된 아이콘이 준비되면 교체한다. 마크가 중앙 62% 안에 있어 안드로이드
마스커블 아이콘으로 잘려도 안전하다.
