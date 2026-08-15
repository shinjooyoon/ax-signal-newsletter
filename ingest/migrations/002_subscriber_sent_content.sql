-- ============================================================
-- 구독자별로 "이미 보낸 콘텐츠"를 기록해서, 다음 발송부터 같은 콘텐츠가
-- (특히 is_pinned=true인 SK AX 콘텐츠가) 반복 노출되지 않도록 막는다.
-- schema.sql 적용 이후에 추가로 실행하세요.
-- ============================================================

create table subscriber_sent_content (
  subscriber_id    uuid not null references subscribers(id) on delete cascade,
  content_item_id  uuid not null references content_items(id) on delete cascade,
  send_id          uuid not null references sends(id) on delete cascade,
  sent_at          timestamptz not null default now(),
  primary key (subscriber_id, content_item_id)
);

alter table subscriber_sent_content enable row level security;

create index idx_subscriber_sent_content_send_id on subscriber_sent_content(send_id);
