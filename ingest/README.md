# AX Signal — 콘텐츠 수집 + 태깅 + 매칭 + 발송 파이프라인

## 준비

```bash
npm install
cp .env.example .env   # 값 채워넣기
```

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase 프로젝트 Settings > API
- `ANTHROPIC_API_KEY`: Claude API 키
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL`: 이메일 발송용 (6단계, resend.com). 발신 도메인
  인증 전에는 `RESEND_FROM_EMAIL=onboarding@resend.dev`로 두면 계정 본인 이메일로만 테스트 가능
- `WEB_BASE_URL` (선택): 이메일 하단 "관심 분야 바꾸기"/"구독 해지" 링크가 가리킬 가입 폼
  주소. 안 넣으면 `https://ax-signal-newsletter.vercel.app`로 기본 동작하므로, 도메인을
  바꾸지 않는 한 새로 설정 안 해도 됨

### Supabase에 스키마 적용 (새 프로젝트라면 순서대로 전부 실행)

SQL Editor에서 **이 순서 그대로** 실행:

1. `../schema.sql` (1~2단계 — 태그 체계 + 기본 테이블)
2. `migrations/002_subscriber_sent_content.sql` (중복 발송 방지)
3. `migrations/003_shared_content_history.sql` (SK AX/태그별 공유 큐 — "같은 태그=같은 콘텐츠")
4. `migrations/004_reduce_tags.sql` (태그 10개 → 5개로 축소, 데이터 삭제 포함)
5. `migrations/005_tag_on_sent_content.sql` (이메일에 관심 분야 배지 표시용)
6. `migrations/006_external_news_history.sql` (외부뉴스 전체 공유 풀)
7. `migrations/007_chemistry_out_bio_rename.sql` (화학 제거, 헬스케어→바이오 이름 변경)
8. `migrations/008_terms.sql` ("오늘의 용어" 글로서리 테이블)

`content_items.summary`가 요약 기능 도입 전 값(RSS 원문 스니펫)을 그대로 담고 있다면,
`npm run backfill:summaries`로 한 번 재서술본으로 갈아끼워야 이메일에 요약이 제대로 뜬다
(새 프로젝트에서 처음부터 시작하면 필요 없음 — `ingestRss.js` 등이 이제 처음부터 재서술해서 저장함).

## 1. 외부 RSS 소스 (자동 수집)

`config/sources.json`에 RSS 피드를 추가하고 `enabled: true`로 설정.

```bash
npm run ingest:rss:dry   # DB/Claude 호출 없이 파싱 결과만 확인
npm run ingest:rss       # 실제 수집 + 자동 태깅 + 저장
```

동작 방식: 피드의 각 항목을 가져와 `content_items.url` 기준으로 중복이면 건너뛰고,
새 항목이면 저장 후 Claude API로 태그를 붙여 `content_tags`에 저장한다.
`content_type`은 항상 `external`로 들어간다.

정기 실행하려면 cron이나 GitHub Actions 스케줄로 `npm run ingest:rss`를 주기적으로 돌리면 된다.

```bash
npm run prune:news   # 7일 넘게 안 뽑힌 "뉴스" 후보를 삭제 (AI 뉴스는 공급이 넉넉해서 오래 쌓아둘 필요 없음)
```

SK AX/SK 계열사 콘텐츠는 공급이 적어서(바이오는 이미 0개) 대상에서 제외되고, 이미 발송된
적 있는 콘텐츠도 지우지 않는다 — `.github/workflows/daily-digest.yml`에서 `ingest:rss` 직후
자동 실행됨.

## 2. SK AX 자사 콘텐츠 (수동 등록)

SK AX 뉴스룸/인사이트·트렌드/케이스 스터디는 RSS 또는 sitemap 제공 여부가
아직 확인되지 않아서, 우선은 링크를 수동으로 넣으면 나머지(태깅, 저장,
상단 고정)는 자동으로 처리되는 스크립트로 만들었다.

```bash
npm run add:skax -- \
  --title "제목" \
  --url "https://www.skax.co.kr/insight/trends/xxx" \
  --type insight \
  --summary "간단 요약 (선택)"
```

- `--type`: `news`(뉴스룸) / `insight`(인사이트·트렌드) / `case_study`(케이스 스터디)
- 자동으로 `is_pinned = true`로 저장되어, 구독자의 관심 태그와 무관하게
  다이제스트 상단에 항상 노출된다 (schema.sql의 `is_pinned` 참고).
- RSS/sitemap이 나중에 확인되면 `ingestRss.js`와 동일한 구조로
  자동 수집 스크립트로 옮기면 된다 (지금 로직을 거의 그대로 재사용 가능).

## 2b. SK 계열사 콘텐츠 (`proposal/sk-affiliate-rotation` 브랜치, 수동 등록)

RSS 없는 계열사(SK네트웍스/SKC/SK에코플랜트/SK주식회사/SK케미칼 등)는 `add:skax`와
똑같은 방식으로 등록한다. 회사별 실제 조사 결과는 `docs/proposal-sk-affiliate-rotation.md` 참고.

```bash
npm run add:affiliate -- \
  --title "제목" \
  --url "https://..." \
  --source "SK네트웍스" \
  --summary "간단 요약 (선택)"
```

`--source` 값이 `src/constants.js`의 `AFFILIATE_SOURCES`에 있어야 "SK 소식" 섹션으로 분류됨.

## 3. 구독자 가입 (`web/` — Next.js)

`web/`에 별도 Next.js 앱으로 가입 폼이 있다. `web/.env.local`에 같은 `SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY`를 넣고 `npm install && npm run dev`로 실행하면 `localhost:3000`에서
이메일 + 관심 태그(체크박스)를 받아 `subscribers`/`subscriber_tags`에 저장한다.

## 4. 발송 회차 매칭

```bash
npm run build:issue                    # 오늘 날짜 기준
npm run build:issue -- --date 2026-08-20   # 특정 날짜 지정 (테스트용)
npm run build:issue -- --force         # 주말이어도 강제 실행
```

활성 구독자별로 콘텐츠를 매칭해 `sends`에 저장한다. 기본적으로 토/일은 스킵됨(`--force`로 무시 가능).
`proposal/sk-affiliate-rotation` 브랜치에서는 "같은 태그를 고른 구독자는 전부 같은 콘텐츠를 받는" 공유 큐
구조로 되어 있음 — 자세한 내용은 `docs/proposal-sk-affiliate-rotation.md` 참고.

## 5. 이메일 발송

```bash
npm run send:digest                    # 오늘 날짜 기준, build:issue로 만든 sends를 실제 발송
npm run send:digest -- --date 2026-08-20
```

Resend로 실제 이메일을 보내고 `sends.sent_at`을 기록한다. 발신 도메인 인증 전엔
`onboarding@resend.dev`로 계정 본인 이메일에만 발송 가능.

## 검증 방법

- `npm run ingest:rss:dry`로 RSS 파싱이 되는지 먼저 확인 (네트워크/피드 URL 문제 조기 발견)
- Supabase 대시보드의 Table Editor에서 `content_items` / `content_tags`에
  실제로 들어갔는지, `confidence` 값이 그럴듯한지 확인
- `confidence`가 낮은(예: 0.6 미만) 태깅은 `content_tags.verified = false`
  상태로 남아있으니, 초반에는 사람이 한 번씩 훑어보는 걸 추천

## 남은 것

- 발신 도메인 인증 (지금은 계정 본인 이메일로만 테스트 가능)
- 정기 실행 자동화 (cron/GitHub Actions로 `ingest:rss` → `build:issue` → `send:digest` 스케줄링)
- 구독 해지, 개인화 다이제스트 웹페이지(`sends.digest_token` 활용, 아직 미구현)
