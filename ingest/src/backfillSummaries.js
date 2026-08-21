import 'dotenv/config';
import { getSupabase } from './db.js';
import { summarizeContent } from './summarizer.js';

// content_items.summary는 요약 기능 도입 전까지 RSS 원문 스니펫이 그대로 들어있었다.
// 이제 이메일에서 summary를 그대로 보여주므로, 기존 값을 전부 재서술본으로 한 번
// 갈아끼운다(원문 그대로 보여주는 건 저작권 문제라 안 됨). 재서술 실패(원문이 너무
// 짧음 등)하면 null로 남겨서 이메일에서 요약 없이 제목만 보이게 한다.
// 한 번만 실행하면 되는 마이그레이션 스크립트: npm run backfill:summaries

async function main() {
  const supabase = getSupabase();
  const { data: items, error } = await supabase
    .from('content_items')
    .select('id, title, summary')
    .not('summary', 'is', null);
  if (error) throw error;

  console.log(`대상 ${items.length}건`);

  let updated = 0;
  let cleared = 0;
  for (const item of items) {
    const newSummary = await summarizeContent({ title: item.title, rawText: item.summary });
    const { error: updateError } = await supabase.from('content_items').update({ summary: newSummary }).eq('id', item.id);
    if (updateError) {
      console.error(`  [실패] ${item.title}: ${updateError.message}`);
      continue;
    }
    if (newSummary) {
      updated += 1;
      console.log(`  [갱신] ${item.title}`);
    } else {
      cleared += 1;
      console.log(`  [비움-원문 너무 짧음] ${item.title}`);
    }
  }

  console.log(`완료: 갱신 ${updated} / 비움 ${cleared} / 전체 ${items.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
