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

const STALE_CUTOFF_DAYS = 30; // 이보다 오래된 건 후보에서 아예 제외

function effectiveDate(item) {
  return item.published_at ?? item.created_at;
}

/**
 * 당일 뉴스가 있으면 그걸 우선, 없으면 FIFO(오래된 것부터)로 선택되도록 정렬한다.
 * "최신순"으로만 하면 새 뉴스가 계속 들어올 때마다 예전에 모아둔 콘텐츠가 뒤로 밀려서
 * 영영 안 나가는 문제가 있어서, 당일 것 소진하고 나면 쌓인 콘텐츠를 순서대로 활용한다.
 */
function sortForSelection(items) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return items.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aDate = effectiveDate(a);
    const bDate = effectiveDate(b);
    const aIsToday = aDate?.slice(0, 10) === todayStr;
    const bIsToday = bDate?.slice(0, 10) === todayStr;
    if (aIsToday !== bIsToday) return aIsToday ? -1 : 1;
    return new Date(aDate) - new Date(bDate); // 오래된 것부터(FIFO)
  });
}

/**
 * 구독자의 관심 태그와 매칭되는 콘텐츠 + is_pinned(SK AX 자사) 콘텐츠를 합쳐서 반환한다.
 * schema.sql 하단의 매칭 쿼리 참고. excludeSent가 true(기본)면 이미 보낸 콘텐츠는 제외한다
 * (한번 보낸 콘텐츠는 평생 다시 안 보냄 — SK AX처럼 is_pinned=true인 콘텐츠가 반복 노출되는 걸 막기 위함).
 * STALE_CUTOFF_DAYS보다 오래된 건 아예 후보에서 뺀다 ("너무 오래된 거 아니면" 조건).
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

  const cutoff = Date.now() - STALE_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
  const fresh = (items ?? []).filter((item) => new Date(effectiveDate(item)).getTime() >= cutoff);

  return sortForSelection(fresh);
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
