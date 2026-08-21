-- ============================================================
-- "오늘의 용어" 글로서리 — 그날 실린 콘텐츠에서 뽑은 AI/AX 용어 + 뜻풀이.
-- 발송 회차(issue)마다 전역으로 최대 1개만 뽑아 모든 구독자가 동일하게 받는다
-- (SK AX/뉴스와 같은 "공유 픽" 방식). term 컬럼으로 이미 다룬 용어를 걸러내
-- 중복 설명을 피하고, 나중에 별도 용어집 페이지의 데이터 소스로도 재사용한다.
-- ============================================================

create table terms (
  id                uuid primary key default gen_random_uuid(),
  issue_id          uuid not null references issues(id) on delete cascade,
  term              text not null,
  definition        text not null,
  source_content_id uuid references content_items(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table terms enable row level security;

create index idx_terms_issue_id on terms(issue_id);
