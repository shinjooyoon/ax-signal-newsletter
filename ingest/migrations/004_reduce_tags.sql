-- ============================================================
-- 태그를 10개 -> 5개로 축소 (반도체/에너지/화학/헬스케어/일반 AI 트렌드만 유지).
-- SK 계열사 커버리지가 실제로 좋은 분야 위주로 남기고, 나머지는 삭제.
-- content_tags / subscriber_tags는 tag_id에 on delete cascade가 걸려 있어서
-- 이 태그들과 연결된 매칭/구독 정보도 함께 정리된다.
-- ============================================================

delete from tags where slug in ('ai-manufacturing', 'ai-finance', 'ai-mobility', 'ai-robotics', 'ai-retail');
