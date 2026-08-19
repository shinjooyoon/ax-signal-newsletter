-- ============================================================
-- 외부뉴스("뉴스" 섹션)는 이제 태그 매칭 없이 전체 구독자가 공유하는
-- 하나의 큐에서 그냥 다음 것 2개를 뽑는다 (SK AX와 같은 방식).
-- 태그별로 뽑으면 화학/반도체/헬스케어처럼 원래 풀이 작은 태그가
-- 금방 소진돼서 편차가 심했음 — 전체 풀을 공유하면 훨씬 오래 감.
-- ============================================================

create table external_news_history (
  content_item_id  uuid primary key references content_items(id) on delete cascade,
  used_at          timestamptz not null default now()
);

alter table external_news_history enable row level security;
