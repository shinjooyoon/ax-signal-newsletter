import 'dotenv/config';
import { getSupabase } from './db.js';
import { AFFILIATE_SOURCES } from './constants.js';

// 태그별/SK AX/외부뉴스 공유 큐에 아직 안 쓴 콘텐츠가 몇 개 남았는지 한눈에 보여준다.
// npm run status

async function main() {
  const supabase = getSupabase();

  // SK AX (전체 공유)
  const { count: pinnedTotal } = await supabase
    .from('content_items')
    .select('*', { count: 'exact', head: true })
    .eq('is_pinned', true);
  const { count: pinnedUsed } = await supabase
    .from('pinned_content_history')
    .select('*', { count: 'exact', head: true });
  console.log(`SK AX (전체 공유)         전체 ${pinnedTotal ?? 0} / 사용 ${pinnedUsed ?? 0} / 남음 ${(pinnedTotal ?? 0) - (pinnedUsed ?? 0)}`);

  // 뉴스 (전체 공유, 태그 무관 — 태깅은 돼 있어야 후보)
  const { data: taggedRows } = await supabase.from('content_tags').select('content_item_id');
  const taggedIds = new Set((taggedRows ?? []).map((r) => r.content_item_id));
  const { data: allNonPinned } = await supabase
    .from('content_items')
    .select('id, source')
    .eq('is_pinned', false);
  const newsCandidates = (allNonPinned ?? []).filter(
    (item) => !AFFILIATE_SOURCES.has(item.source) && taggedIds.has(item.id)
  );
  const { count: newsUsed } = await supabase
    .from('external_news_history')
    .select('*', { count: 'exact', head: true });
  console.log(`뉴스 (전체 공유)          전체 ${newsCandidates.length} / 사용 ${newsUsed ?? 0} / 남음 ${newsCandidates.length - (newsUsed ?? 0)}`);

  console.log('');
  console.log('태그별 (SK 계열사만 태그 매칭, 뉴스는 위에서 이미 전체 공유로 처리됨)');

  const { data: tags } = await supabase.from('tags').select('id, slug, name').not('parent_id', 'is', null).order('name');
  for (const tag of tags ?? []) {
    const { data: contentTags } = await supabase.from('content_tags').select('content_item_id').eq('tag_id', tag.id);
    const ids = (contentTags ?? []).map((r) => r.content_item_id);
    const { data: items } = await supabase
      .from('content_items')
      .select('id, source, is_pinned')
      .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const affiliateTotal = (items ?? []).filter((i) => !i.is_pinned && AFFILIATE_SOURCES.has(i.source)).length;

    const { count: used } = await supabase
      .from('tag_content_history')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', tag.id);

    console.log(
      `  ${tag.name.padEnd(10)} SK 계열사 전체 ${affiliateTotal} / 사용 ${used ?? 0} / 남음 ${affiliateTotal - (used ?? 0)}`
    );
  }

  console.log('');
  const { count: subscriberCount } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  console.log(`활성 구독자: ${subscriberCount ?? 0}명`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
