-- ============================================================
-- 클릭 추적 — 이메일 속 기사 링크를 누르면 /r/[digest_token]/[content_item_id] 를 거쳐
-- 원문으로 이동하고, 그 순간 이 테이블에 한 줄을 남긴다.
--
-- 왜 필요한가: sends.opened_at / clicked_at 컬럼은 처음부터 있었지만 채우는 코드가 없어
-- "무엇이 읽히는지"를 전혀 측정할 수 없었다. 오픈은 애플 메일 개인정보 보호 기능이
-- 부풀리므로 추적하지 않고, 클릭만 기사 단위로 기록한다.
--
-- 수집 범위: 어느 발송(send)의 어느 기사가, 메일의 어느 위치에서, 언제 클릭됐는지만.
-- IP·기기·브라우저 정보는 저장하지 않는다.
--
-- 분석 시 주의: 회사 메일의 보안 게이트웨이(예: Outlook Safe Links)는 메일 수신 직후
-- 링크를 자동으로 열어보기 때문에 사람이 누르지 않은 클릭이 섞일 수 있다.
-- 분석 단계에서 "발송 직후 수십 초 안에 같은 메일의 링크가 한꺼번에 눌린 경우"를 걸러낸다.
-- ============================================================

create table click_events (
  id               uuid primary key default gen_random_uuid(),
  send_id          uuid not null references sends(id) on delete cascade,
  content_item_id  uuid not null references content_items(id) on delete cascade,
  link_position    text check (link_position in ('hero', 'sk', 'news', 'term')),
                                               -- 메일 속 위치: 오늘의 시그널 / SK 소식 / 뉴스 / 오늘의 용어 출처
  clicked_at       timestamptz not null default now()
);

alter table click_events enable row level security;

create index idx_click_events_send_id on click_events(send_id);
create index idx_click_events_content_item_id on click_events(content_item_id);
