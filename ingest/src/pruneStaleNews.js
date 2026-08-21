import 'dotenv/config';
import { getSupabase } from './db.js';
import { AFFILIATE_SOURCES } from './constants.js';

// "뉴스" 풀(태그 무관 외부뉴스)은 AI 뉴스 공급이 넉넉해서 굳이 오래 쌓아둘 필요가 없다.
// 7일 넘게 안 뽑힌 후보는 그냥 지워서 풀을 신선하게 유지한다.
// SK AX(is_pinned)와 SK 계열사 콘텐츠는 공급이 적어서(바이오는 이미 0개) 절대 여기서
// 지우지 않는다 — 오직 "뉴스" 후보만 대상. 이미 발송된 적 있는 콘텐츠도 발송 이력이라
// 지우지 않고, external_news_history에 아직 안 올라간(=한 번도 안 뽑힌) 것만 지운다.
const STALE_DAYS = 7;

function effectiveDate(item) {
  return item.published_at ?? item.created_at;
}

async function main() {
  const supabase = getSupabase();

  const { data: usedRows } = await supabase.from('external_news_history').select('content_item_id');
  const usedIds = new Set((usedRows ?? []).map((r) => r.content_item_id));

  const { data: items, error } = await supabase
    .from('content_items')
    .select('id, title, source, published_at, created_at')
    .eq('is_pinned', false);
  if (error) throw error;

  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const stale = (items ?? []).filter(
    (item) =>
      !AFFILIATE_SOURCES.has(item.source) &&
      !usedIds.has(item.id) &&
      new Date(effectiveDate(item)).getTime() < cutoff
  );

  if (stale.length === 0) {
    console.log('삭제할 오래된 뉴스 후보 없음.');
    return;
  }

  const { error: deleteError } = await supabase
    .from('content_items')
    .delete()
    .in('id', stale.map((item) => item.id));
  if (deleteError) throw deleteError;

  console.log(`삭제 완료: ${stale.length}건 (7일 넘게 안 쓰인 뉴스 후보)`);
  stale.forEach((item) => console.log(`  - ${item.title} (${item.source})`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
