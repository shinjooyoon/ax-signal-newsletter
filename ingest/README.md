# AX Signal — 콘텐츠 수집 + 자동 태깅 파이프라인 (3단계)

## 준비

```bash
npm install
cp .env.example .env   # 값 채워넣기
```

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase 프로젝트 Settings > API
- `ANTHROPIC_API_KEY`: Claude API 키
- 실행 전에 `schema.sql`이 이미 Supabase에 적용되어 있어야 함 (1~2단계 결과물)

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

## 검증 방법

- `npm run ingest:rss:dry`로 RSS 파싱이 되는지 먼저 확인 (네트워크/피드 URL 문제 조기 발견)
- Supabase 대시보드의 Table Editor에서 `content_items` / `content_tags`에
  실제로 들어갔는지, `confidence` 값이 그럴듯한지 확인
- `confidence`가 낮은(예: 0.6 미만) 태깅은 `content_tags.verified = false`
  상태로 남아있으니, 초반에는 사람이 한 번씩 훑어보는 걸 추천

## 다음 단계

여기서 만든 `content_items` + `content_tags`가 준비되면, 4단계(구독자 관심사
수집)와 5단계(개인화 매칭 로직)로 이어진다. schema.sql 하단에 남겨둔
매칭 쿼리 예시를 참고.
