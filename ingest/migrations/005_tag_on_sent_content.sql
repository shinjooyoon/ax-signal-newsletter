-- ============================================================
-- subscriber_sent_content에 "이 콘텐츠가 어떤 태그 때문에 선택됐는지" 기록.
-- SK AX(pinned)처럼 태그와 무관하게 뽑힌 건 null로 남는다.
-- 이메일에서 "반도체" 같은 배지를 보여주는 데 사용.
-- ============================================================

alter table subscriber_sent_content add column tag_id uuid references tags(id) on delete set null;
