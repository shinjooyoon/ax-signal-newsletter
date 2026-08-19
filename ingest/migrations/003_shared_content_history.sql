-- ============================================================
-- "같은 태그를 고른 구독자는 전부 같은 콘텐츠를 받는다" 구조로 전환하기 위한 테이블.
-- 기존 subscriber_sent_content(구독자별 개별 진행상황)는 그대로 두되(이번 발송에
-- 실제로 뭘 보냈는지 기록/재사용하는 용도로만 계속 씀), 콘텐츠를 "다음에 뭘 보낼지"
-- 결정하는 건 이제 구독자 단위가 아니라 태그 단위(+SK AX는 전체 공유)로 한다.
-- ============================================================

-- SK AX(is_pinned) 콘텐츠는 태그와 무관하게 전체 구독자가 공유하는 큐
create table pinned_content_history (
  content_item_id  uuid primary key references content_items(id) on delete cascade,
  used_at          timestamptz not null default now()
);

alter table pinned_content_history enable row level security;

-- 태그별 콘텐츠 큐 — 같은 태그를 고른 구독자는 전부 같은 진행상황을 공유
create table tag_content_history (
  tag_id           uuid not null references tags(id) on delete cascade,
  content_item_id  uuid not null references content_items(id) on delete cascade,
  used_at          timestamptz not null default now(),
  primary key (tag_id, content_item_id)
);

alter table tag_content_history enable row level security;
