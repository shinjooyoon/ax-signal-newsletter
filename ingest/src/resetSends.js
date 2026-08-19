import 'dotenv/config';
import { getSupabase } from './db.js';

// 테스트하면서 쌓인 "발송 기록"만 전부 지운다. subscribers/subscriber_tags/
// content_items/content_tags/tags는 그대로 둔다 — 실제 구독자·콘텐츠 데이터라서.
// npm run reset:sends

async function main() {
  const supabase = getSupabase();

  // 조건 없는 delete는 PostgREST가 막아서, 각 테이블에 실제 있는 컬럼으로 "항상 참" 조건을 만든다
  const tables = [
    { name: 'subscriber_sent_content', column: 'content_item_id' },
    { name: 'sends', column: 'id' },
    { name: 'pinned_content_history', column: 'content_item_id' },
    { name: 'tag_content_history', column: 'content_item_id' },
    { name: 'external_news_history', column: 'content_item_id' },
    { name: 'issues', column: 'id' }
  ];

  for (const { name, column } of tables) {
    const { error, count } = await supabase.from(name).delete({ count: 'exact' }).not(column, 'is', null);
    if (error) {
      console.error(`[실패] ${name}: ${error.message}`);
    } else {
      console.log(`[초기화] ${name} — ${count ?? '?'}행 삭제`);
    }
  }

  console.log('완료. 구독자/콘텐츠/태그는 그대로고, 발송 이력만 전부 초기화됨.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
