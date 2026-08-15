import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. .env.example을 .env로 복사해서 채워주세요.'
    );
  }
  // service_role 키 사용 → RLS를 우회해서 서버 사이드에서만 쓰는 클라이언트
  return createClient(url, key);
}

/**
 * 'ai' 최상위 태그를 제외한 리프 태그 목록을 가져온다.
 * (자동 태깅은 세부 분야에만 붙이면 되므로)
 */
export async function getLeafTags(supabase) {
  const { data, error } = await supabase
    .from('tags')
    .select('id, slug, name')
    .not('parent_id', 'is', null);
  if (error) throw error;
  return data;
}

/**
 * 구독자에게 이미 보낸 콘텐츠 id 목록 (subscriber_sent_content 기준).
 */
export async function getSentContentIds(supabase, subscriberId) {
  const { data } = await supabase
    .from('subscriber_sent_content')
    .select('content_item_id')
    .eq('subscriber_id', subscriberId);
  return new Set((data ?? []).map((r) => r.content_item_id));
}

/**
 * 구독자의 관심 태그와 매칭되는 콘텐츠 + is_pinned(SK AX 자사) 콘텐츠를 합쳐서 반환한다.
 * schema.sql 하단의 매칭 쿼리 참고. excludeSent가 true(기본)면 이미 보낸 콘텐츠는 제외한다
 * (SK AX처럼 is_pinned=true인 콘텐츠가 발송할 때마다 반복 노출되는 걸 막기 위함).
 */
export async function getMatchedContent(supabase, subscriberId, { excludeSent = true } = {}) {
  const { data: subscriberTags } = await supabase
    .from('subscriber_tags')
    .select('tag_id')
    .eq('subscriber_id', subscriberId);
  const tagIds = (subscriberTags ?? []).map((t) => t.tag_id);

  const matchedIds = new Set();

  if (tagIds.length > 0) {
    const { data: contentTags } = await supabase
      .from('content_tags')
      .select('content_item_id')
      .in('tag_id', tagIds);
    (contentTags ?? []).forEach((ct) => matchedIds.add(ct.content_item_id));
  }

  const { data: pinned } = await supabase.from('content_items').select('id').eq('is_pinned', true);
  (pinned ?? []).forEach((p) => matchedIds.add(p.id));

  if (excludeSent) {
    const sentIds = await getSentContentIds(supabase, subscriberId);
    sentIds.forEach((id) => matchedIds.delete(id));
  }

  if (matchedIds.size === 0) return [];

  const { data: items } = await supabase
    .from('content_items')
    .select('id, title, url, summary, source, is_pinned, published_at, created_at')
    .in('id', Array.from(matchedIds));

  return (items ?? []).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aDate = a.published_at ?? a.created_at;
    const bDate = b.published_at ?? b.created_at;
    return new Date(bDate) - new Date(aDate);
  });
}

/**
 * send_id 기준으로 실제 이 발송에 포함됐던 콘텐츠 목록을 가져온다 (발송 시점 재사용용).
 */
export async function getContentForSend(supabase, sendId) {
  const { data: rows } = await supabase
    .from('subscriber_sent_content')
    .select('content_item_id')
    .eq('send_id', sendId);
  const ids = (rows ?? []).map((r) => r.content_item_id);
  if (ids.length === 0) return [];

  const { data: items } = await supabase
    .from('content_items')
    .select('id, title, url, summary, source, is_pinned, published_at, created_at')
    .in('id', ids);

  return (items ?? []).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aDate = a.published_at ?? a.created_at;
    const bDate = b.published_at ?? b.created_at;
    return new Date(bDate) - new Date(aDate);
  });
}
