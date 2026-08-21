import { createClient } from '@supabase/supabase-js';
import { AFFILIATE_SOURCES } from './constants.js';

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

const STALE_CUTOFF_DAYS = 30; // 이보다 오래된 건 후보에서 아예 제외

const kstDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }); // en-CA = YYYY-MM-DD

/**
 * "오늘"을 한국시간(KST) 기준 YYYY-MM-DD로 반환한다. GitHub Actions 등 UTC로 도는
 * 서버에서 new Date().toISOString()을 그대로 쓰면 한국 새벽/아침 시간대에 날짜가
 * 하루 밀려서(예: 월요일 오전 7시 KST가 UTC로는 아직 일요일) 주말로 오인되는 등
 * 버그가 생기므로, 날짜가 필요한 곳은 전부 이 함수를 통해서만 계산한다.
 */
export function todayKST() {
  return kstDateFormatter.format(new Date());
}

function effectiveDate(item) {
  return item.published_at ?? item.created_at;
}

/**
 * 당일 뉴스가 있으면 그걸 우선, 없으면 FIFO(오래된 것부터)로 선택되도록 정렬한다.
 * "최신순"으로만 하면 새 뉴스가 계속 들어올 때마다 예전에 모아둔 콘텐츠가 뒤로 밀려서
 * 영영 안 나가는 문제가 있어서, 당일 것 소진하고 나면 쌓인 콘텐츠를 순서대로 활용한다.
 */
function sortForSelection(items) {
  const todayStr = todayKST();
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

// insight/case_study는 시의성 없는 콘텐츠라 시간이 지나도 계속 재사용한다(SK AX 콘텐츠가
// 워낙 적어서 "케이스 스터디처럼" 오래 우려먹을 걸 의도적으로 허용). news/external만
// 오래되면 후보에서 뺀다 — 뉴스는 며칠 지나면 정보로서의 가치가 떨어지기 때문.
const EVERGREEN_TYPES = new Set(['insight', 'case_study']);

function dropStale(items) {
  const cutoff = Date.now() - STALE_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    if (EVERGREEN_TYPES.has(item.content_type)) return true;
    return new Date(effectiveDate(item)).getTime() >= cutoff;
  });
}

const CONTENT_FIELDS = 'id, title, url, summary, source, is_pinned, content_type, published_at, created_at';

/**
 * 같은 태그를 고른 구독자는 전부 같은 콘텐츠를 받도록, "다음에 뭘 보낼지"를
 * 구독자 단위가 아니라 전역(SK AX) / 태그 단위로 공유해서 결정한다.
 * pinned_content_history / tag_content_history에 이미 쓴 콘텐츠를 기록해두고,
 * 다음 호출부턴 자동으로 제외된다 (언제 가입했든 같은 태그면 같은 진행상황을 봄).
 */

/** SK AX(is_pinned) 콘텐츠 중 아직 아무한테도 안 보낸 다음 1개를 고른다. */
export async function getPinnedPick(supabase) {
  const { data: pinned } = await supabase.from('content_items').select(CONTENT_FIELDS).eq('is_pinned', true);
  const { data: usedRows } = await supabase.from('pinned_content_history').select('content_item_id');
  const usedIds = new Set((usedRows ?? []).map((r) => r.content_item_id));

  const candidates = dropStale((pinned ?? []).filter((item) => !usedIds.has(item.id)));
  const sorted = sortForSelection(candidates);
  return sorted[0] ?? null;
}

/**
 * 특정 태그에 매칭되는 SK 계열사(affiliate) 콘텐츠 중, 이 태그로는 아직 아무한테도
 * 안 보낸 것 최대 1개를 고른다. 외부뉴스는 더 이상 태그 매칭 안 함(getExternalNewsPicks 참고) —
 * 화학/반도체/헬스케어처럼 원래 풀이 작은 태그가 외부뉴스까지 태그로 나누면 너무 빨리
 * 소진돼서, 외부뉴스는 태그 무관 공유 풀로 뺐다.
 */
export async function getTagPicks(supabase, tagId) {
  const { data: contentTags } = await supabase.from('content_tags').select('content_item_id').eq('tag_id', tagId);
  const ids = (contentTags ?? []).map((r) => r.content_item_id);
  if (ids.length === 0) return { affiliate: [] };

  const { data: usedRows } = await supabase
    .from('tag_content_history')
    .select('content_item_id')
    .eq('tag_id', tagId);
  const usedIds = new Set((usedRows ?? []).map((r) => r.content_item_id));

  const { data: items } = await supabase.from('content_items').select(CONTENT_FIELDS).in('id', ids);
  // is_pinned(SK AX)은 getPinnedPick이 전역으로 따로 처리하므로 태그 픽에서는 제외(중복 방지)
  const candidates = dropStale(
    (items ?? []).filter((item) => !item.is_pinned && AFFILIATE_SOURCES.has(item.source) && !usedIds.has(item.id))
  );
  const sorted = sortForSelection(candidates);

  return { affiliate: sorted.slice(0, 1) };
}

/**
 * 외부뉴스("뉴스" 섹션)는 태그 매칭 없이 전체 구독자가 공유하는 큐에서 다음 것 2개를 고른다
 * (SK AX와 같은 방식). is_pinned도 아니고 SK 계열사도 아닌 콘텐츠 전체가 후보이되,
 * Claude 태깅 단계에서 태그가 하나도 안 붙은(=AI/AX와 무관하다고 판단된) 콘텐츠는 제외한다.
 */
export async function getExternalNewsPicks(supabase, count = 2) {
  const { data: usedRows } = await supabase.from('external_news_history').select('content_item_id');
  const usedIds = new Set((usedRows ?? []).map((r) => r.content_item_id));

  const { data: taggedRows } = await supabase.from('content_tags').select('content_item_id');
  const taggedIds = new Set((taggedRows ?? []).map((r) => r.content_item_id));

  const { data: items } = await supabase
    .from('content_items')
    .select(CONTENT_FIELDS)
    .eq('is_pinned', false);
  const candidates = dropStale(
    (items ?? []).filter(
      (item) => !AFFILIATE_SOURCES.has(item.source) && !usedIds.has(item.id) && taggedIds.has(item.id)
    )
  );
  const sorted = sortForSelection(candidates);
  return sorted.slice(0, count);
}

/** pinned_content_history / tag_content_history / external_news_history에 사용 기록을 남긴다. */
export async function markPinnedUsed(supabase, contentItemId) {
  await supabase.from('pinned_content_history').insert({ content_item_id: contentItemId });
}

export async function markTagUsed(supabase, tagId, contentItemIds) {
  if (contentItemIds.length === 0) return;
  const rows = contentItemIds.map((contentItemId) => ({ tag_id: tagId, content_item_id: contentItemId }));
  await supabase.from('tag_content_history').insert(rows);
}

export async function markExternalNewsUsed(supabase, contentItemIds) {
  if (contentItemIds.length === 0) return;
  await supabase.from('external_news_history').insert(contentItemIds.map((contentItemId) => ({ content_item_id: contentItemId })));
}

/**
 * send_id 기준으로 실제 이 발송에 포함됐던 콘텐츠 목록을 가져온다 (발송 시점 재사용용).
 */
export async function getContentForSend(supabase, sendId) {
  const { data: rows } = await supabase
    .from('subscriber_sent_content')
    .select('content_item_id, tag_id, tags(name)')
    .eq('send_id', sendId);
  if (!rows || rows.length === 0) return [];

  const tagNameByItemId = new Map(rows.map((r) => [r.content_item_id, r.tags?.name ?? null]));
  const ids = rows.map((r) => r.content_item_id);

  const { data: items } = await supabase
    .from('content_items')
    .select('id, title, url, summary, source, is_pinned, published_at, created_at')
    .in('id', ids);

  const withTagName = (items ?? []).map((item) => ({ ...item, tagName: tagNameByItemId.get(item.id) ?? null }));

  return withTagName.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aDate = a.published_at ?? a.created_at;
    const bDate = b.published_at ?? b.created_at;
    return new Date(bDate) - new Date(aDate);
  });
}

/** 지금까지 "오늘의 용어"로 다룬 용어 이름 목록 (중복 방지용 프롬프트 제외 목록). */
export async function getUsedTerms(supabase) {
  const { data } = await supabase.from('terms').select('term');
  return [...new Set((data ?? []).map((r) => r.term))];
}

/** 이번 발송 회차의 "오늘의 용어"를 저장한다. 회차당 최대 1개(buildIssue.js가 재실행 시 재선정하지 않음). */
export async function saveTermOfDay(supabase, issueId, { term, definition, sourceContentId }) {
  const { error } = await supabase.from('terms').insert({
    issue_id: issueId,
    term,
    definition,
    source_content_id: sourceContentId ?? null
  });
  if (error) throw error;
}

/** send 시점에 이번 회차의 "오늘의 용어"(있으면)를 가져온다. 전 구독자 공통 — 회차당 1개뿐이라 구독자 무관. */
export async function getTermForIssue(supabase, issueId) {
  const { data } = await supabase
    .from('terms')
    .select('term, definition, content_items!source_content_id(title, url)')
    .eq('issue_id', issueId)
    .maybeSingle();
  if (!data) return null;
  return {
    term: data.term,
    definition: data.definition,
    sourceTitle: data.content_items?.title ?? null,
    sourceUrl: data.content_items?.url ?? null
  };
}

/**
 * 구독자가 고른 태그 중, 이번 send에 콘텐츠가 하나도 안 나온(오늘 소진된) 태그 이름 목록.
 * "없으면 없다고" 표시하기 위해 씀 — 새 컬럼 없이 subscriber_tags와 subscriber_sent_content.tag_id만 비교.
 */
export async function getEmptyTagNames(supabase, subscriberId, sendId) {
  const { data: subTags } = await supabase
    .from('subscriber_tags')
    .select('tag_id, tags(name)')
    .eq('subscriber_id', subscriberId);
  const { data: sentRows } = await supabase.from('subscriber_sent_content').select('tag_id').eq('send_id', sendId);
  const coveredTagIds = new Set((sentRows ?? []).map((r) => r.tag_id).filter(Boolean));

  return (subTags ?? []).filter((t) => !coveredTagIds.has(t.tag_id)).map((t) => t.tags?.name).filter(Boolean);
}
