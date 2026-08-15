-- ============================================================
-- AX Signal — 개인화 뉴스레터 서비스
-- 1~2단계: 태그 체계 + DB 스키마
-- 대상: Postgres (Supabase 기준)
-- ============================================================

create extension if not exists pgcrypto; -- gen_random_uuid() 사용을 위함

-- ------------------------------------------------------------
-- 1. tags — 관심사/카테고리 태그 (계층 구조 지원)
-- ------------------------------------------------------------
create table tags (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,          -- 코드에서 참조할 고유 키 (예: ai-chemistry)
  name         text not null,                 -- 화면에 보여줄 이름 (예: 화학)
  parent_id    uuid references tags(id) on delete set null, -- 상위 태그 (예: ai-chemistry의 부모는 ai)
  description  text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. subscribers — 구독자
-- ------------------------------------------------------------
create table subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  slack_user_id text unique,                  -- 8단계(슬랙 연동)에서 사용, 지금은 nullable
  status        text not null default 'active'
                  check (status in ('active', 'paused', 'unsubscribed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. subscriber_tags — 구독자가 선택한 관심 태그 (다대다)
-- ------------------------------------------------------------
create table subscriber_tags (
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  tag_id        uuid not null references tags(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (subscriber_id, tag_id)
);

-- ------------------------------------------------------------
-- 4. content_items — 수집한 원문/기사
-- ------------------------------------------------------------
create table content_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  url           text unique,
  source        text,                         -- 출처 (매체명, RSS 피드명 등, 예: 'skax.co.kr', 'techcrunch')
  content_type  text not null default 'external'
                  check (content_type in ('news', 'insight', 'case_study', 'external')),
                                              -- news/insight/case_study = SK AX 자사 콘텐츠, external = 일반 수집 기사
  is_pinned     boolean not null default false, -- true면 태그 매칭과 무관하게 다이제스트 상단에 항상 노출 (자사 콘텐츠 차별화용)
  summary       text,                         -- 요약본 (다이제스트에 노출)
  raw_content   text,                         -- 원문 전체 (태깅용, 필요 없으면 생략 가능)
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. content_tags — 콘텐츠별 자동 태깅 결과 (다대다)
-- ------------------------------------------------------------
create table content_tags (
  content_item_id uuid not null references content_items(id) on delete cascade,
  tag_id          uuid not null references tags(id) on delete cascade,
  confidence      numeric(3,2),               -- LLM 태깅 신뢰도 (0.00 ~ 1.00)
  verified        boolean not null default false, -- 사람이 검수했는지 여부
  created_at      timestamptz not null default now(),
  primary key (content_item_id, tag_id)
);

-- ------------------------------------------------------------
-- 6. issues — 발송 회차 (예: 이번 주 다이제스트)
-- ------------------------------------------------------------
create table issues (
  id          uuid primary key default gen_random_uuid(),
  issue_date  date not null,
  status      text not null default 'draft'
                check (status in ('draft', 'sent')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. sends — 구독자별 실제 발송 기록 (채널/열람 추적)
-- ------------------------------------------------------------
create table sends (
  id              uuid primary key default gen_random_uuid(),
  issue_id        uuid not null references issues(id) on delete cascade,
  subscriber_id   uuid not null references subscribers(id) on delete cascade,
  channel         text not null check (channel in ('email', 'slack')),
  digest_token    text unique,                -- 개인화 다이제스트 페이지용 서명 토큰 (7단계)
  summary_bullets jsonb,                      -- 상단 요약 불릿 (LLM이 이 구독자의 매칭 콘텐츠로 생성, 예: ["...", "..."])
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security — 전부 켜두고 별도 정책은 만들지 않음
-- (모든 접근은 서버 사이드에서 service_role 키로 처리 → RLS 우회됨.
--  anon/authenticated 키로는 아무것도 못 읽게 막는 기본 방어막 역할)
-- 나중에 구독자가 브라우저에서 직접 자기 정보를 보게 하려면
-- 그때 "본인 row만 허용" 정책을 추가하면 됨
-- ------------------------------------------------------------
alter table tags             enable row level security;
alter table subscribers      enable row level security;
alter table subscriber_tags  enable row level security;
alter table content_items    enable row level security;
alter table content_tags     enable row level security;
alter table issues           enable row level security;
alter table sends            enable row level security;

-- ------------------------------------------------------------
-- 인덱스
-- ------------------------------------------------------------
create index idx_tags_parent_id             on tags(parent_id);
create index idx_content_tags_tag_id        on content_tags(tag_id);
create index idx_subscriber_tags_subscriber on subscriber_tags(subscriber_id);
create index idx_content_items_published_at on content_items(published_at desc);
create index idx_sends_subscriber_id        on sends(subscriber_id);
create index idx_sends_issue_id             on sends(issue_id);

-- ============================================================
-- 태그 체계 시드 데이터 (1단계 결과물)
-- "AI"를 대주제로 두고, 그 아래 세부 분야를 다중 선택 가능하도록 구성
-- 필요에 따라 자유롭게 추가/삭제하세요
-- ============================================================

insert into tags (slug, name) values ('ai', 'AI (대주제)');

insert into tags (slug, name, parent_id)
select t.slug, t.name, (select id from tags where slug = 'ai')
from (values
  ('ai-chemistry',     '화학'),
  ('ai-manufacturing',  '제조'),
  ('ai-semiconductor',  '반도체'),
  ('ai-healthcare',     '헬스케어/바이오'),
  ('ai-finance',        '금융'),
  ('ai-energy',         '에너지'),
  ('ai-mobility',       '자동차/모빌리티'),
  ('ai-robotics',       '로보틱스'),
  ('ai-retail',         '리테일/유통'),
  ('ai-general',        '일반 AI 트렌드')
) as t(slug, name);

-- ============================================================
-- 참고: 5단계(개인화 매칭 로직)에서 쓸 쿼리 미리보기
-- 특정 구독자의 관심 태그와 겹치는 콘텐츠 + SK AX 자사 콘텐츠(is_pinned)를
-- 함께 최신순으로 뽑는 예시. is_pinned 콘텐츠는 구독 태그와 상관없이
-- 항상 포함시켜서 "일반 뉴스레터와의 차별점"으로 노출.
-- ============================================================
-- select distinct ci.*
-- from content_items ci
-- left join content_tags ct on ct.content_item_id = ci.id
-- left join subscriber_tags st on st.tag_id = ct.tag_id and st.subscriber_id = :subscriber_id
-- where ci.is_pinned = true
--    or st.subscriber_id = :subscriber_id
-- order by ci.is_pinned desc, ci.published_at desc;

-- ============================================================
-- 참고: 6단계(발송) 직전에 생성할 상단 요약 불릿
-- 위 쿼리로 뽑은 구독자별 콘텐츠 목록을 LLM에 넘겨
-- "3~5개 불릿으로 핵심만 요약" 프롬프트를 실행한 결과를
-- sends.summary_bullets 에 저장해두면, 이메일/웹페이지/슬랙 링크가
-- 모두 같은 요약을 재사용할 수 있음 (매번 재생성할 필요 없음)
-- ============================================================
-- update sends set summary_bullets = '["SK AX, 반도체 공정 최적화 AI 사례 공개", "화학 산업 AI 도입 최신 동향 3건"]'::jsonb
-- where id = :send_id;
