# AX Signal

SK AX 관련 콘텐츠를 수집·태깅해서, 구독자가 고른 관심 분야에 맞게 개인화된
이메일 뉴스레터로 매일 보내주는 파이프라인.

## 폴더 구조

- **[`ingest/`](ingest/README.md)** — 콘텐츠 수집(RSS 자동 + 수동 등록), Claude 자동 태깅,
  구독자별 매칭, 이메일 발송까지 전부 여기 있는 Node.js 스크립트들이 처리한다.
  **자세한 사용법은 [`ingest/README.md`](ingest/README.md) 참고.**
- **[`web/`](web/)** — 구독자가 이메일/관심 태그를 등록하는 가입 폼 (Next.js).
- **[`schema.sql`](schema.sql)** — Supabase(Postgres) DB 스키마. 새 Supabase 프로젝트에
  제일 먼저 실행해야 하는 파일.
- **[`docs/`](docs/)** — 기능 제안/조사 문서.

## 처음 시작할 때

1. Supabase 프로젝트 만들고 SQL Editor에서 `schema.sql`부터 실행
   (그 다음 순서는 [`ingest/README.md`](ingest/README.md)의 "Supabase에 스키마 적용" 참고)
2. `ingest/` 폴더에서 `.env` 채우고 `npm install`
3. `web/` 폴더에서 `.env.local` 채우고 `npm install`

## 브랜치

- **`main`** — 팀 합의된 부분만. 콘텐츠 수집 → 태깅 → 가입폼 → 매칭 → 발송까지 전체
  파이프라인이 실제로 동작하는 상태.
- **`proposal/sk-affiliate-rotation`** — 아직 팀원 논의/승인 전인 제안 사항들
  (SK 계열사 소식 추가, 태그 축소 등). 자세한 내용은
  [`docs/proposal-sk-affiliate-rotation.md`](docs/proposal-sk-affiliate-rotation.md) 참고.
