import 'dotenv/config';
import { getSupabase, getLeafTags } from './db.js';
import { tagContent } from './tagger.js';
import { summarizeContent } from './summarizer.js';

// SK 계열사 중 RSS가 없는 곳(SK이노베이션 E&S, SK이노베이션, SK바이오팜 등)은
// 이 스크립트로 수동 등록한다. addSkaxContent.js와 거의 같지만:
// - is_pinned은 false (SK AX처럼 항상 고정 노출이 아니라, 태그 매칭될 때만 노출)
// - source가 회사명이라서 buildIssue.js의 AFFILIATE_SOURCES에 포함돼야 "계열사" 섹션으로 분류됨
//   (ingest/src/constants.js 참고)

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = (args[i] ?? '').replace(/^--/, '');
    out[key] = args[i + 1];
  }
  return out;
}

function printUsage() {
  console.log(`
사용법:
  node src/addAffiliateContent.js \\
    --title "제목" \\
    --url "https://..." \\
    --source "SK이노베이션 E&S" \\
    --summary "간단 요약 (선택)"
`);
}

async function main() {
  const args = parseArgs();
  if (!args.title || !args.url || !args.source) {
    printUsage();
    process.exit(1);
  }

  const supabase = getSupabase();
  const leafTags = await getLeafTags(supabase);

  const { data: existing } = await supabase
    .from('content_items')
    .select('id')
    .eq('url', args.url)
    .maybeSingle();
  if (existing) {
    console.log('이미 등록된 URL입니다:', args.url);
    return;
  }

  // --summary로 넣은 텍스트를 그대로 저장하면 원문을 옮겨 적었을 때 저작권 문제가 생길 수
  // 있어서, RSS와 동일하게 재서술을 거친다(너무 짧으면 null).
  const summary = args.summary ? await summarizeContent({ title: args.title, rawText: args.summary }) : null;

  const { data: inserted, error: insertError } = await supabase
    .from('content_items')
    .insert({
      title: args.title,
      url: args.url,
      source: args.source,
      content_type: 'external',
      is_pinned: false,
      summary
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('저장 실패:', insertError.message);
    process.exit(1);
  }

  const tags = await tagContent({ title: args.title, summary: summary ?? args.summary }, leafTags);
  if (tags.length > 0) {
    const rows = tags
      .map((t) => {
        const tag = leafTags.find((lt) => lt.slug === t.slug);
        if (!tag) return null;
        return { content_item_id: inserted.id, tag_id: tag.id, confidence: t.confidence };
      })
      .filter(Boolean);
    if (rows.length > 0) {
      await supabase.from('content_tags').insert(rows);
    }
  }

  console.log('등록 완료:', args.title, `(${args.source})`);
  console.log('자동 태깅 결과:', tags.map((t) => `${t.slug}(${t.confidence})`).join(', ') || '없음');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
