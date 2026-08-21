import 'dotenv/config';
import { getSupabase, getLeafTags } from './db.js';
import { tagContent } from './tagger.js';
import { summarizeContent } from './summarizer.js';

// SK AX 뉴스룸/인사이트/케이스 스터디는 RSS 확인 전까지 이 스크립트로 수동 등록한다.
// 링크와 제목만 넣으면 태깅과 DB 저장은 자동으로 처리된다.

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
  node src/addSkaxContent.js \\
    --title "제목" \\
    --url "https://www.skax.co.kr/..." \\
    --type news|insight|case_study \\
    --published 2026-08-15 \\
    --summary "간단 요약 (선택)"

--type 값:
  news        뉴스룸 (company/news-rooms) — 원문 발행일 기준 30일 지나면 자동으로 후보에서 빠짐
  insight     인사이트/트렌드 (insight/trends) — 시의성 없어서 오래돼도 계속 후보
  case_study  케이스 스터디 — 시의성 없어서 오래돼도 계속 후보

--published: 원문 페이지에 있는 실제 발행일(YYYY-MM-DD). news는 이게 없으면 "오늘 등록한
             신선한 글"로 착각해서 오래된 뉴스가 계속 재사용될 수 있으니 꼭 넣어주세요.
`);
}

async function main() {
  const args = parseArgs();
  if (!args.title || !args.url || !args.type) {
    printUsage();
    process.exit(1);
  }
  if (!['news', 'insight', 'case_study'].includes(args.type)) {
    console.error(`--type 값이 잘못됐습니다: ${args.type}`);
    printUsage();
    process.exit(1);
  }
  if (args.type === 'news' && !args.published) {
    console.warn('경고: news 타입인데 --published가 없습니다. 발행일 없이는 "오늘 등록 = 오늘 뉴스"로 취급돼서, 실제로는 오래된 뉴스가 신선한 것처럼 계속 재사용될 수 있어요.');
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
      source: 'skax.co.kr',
      content_type: args.type,
      is_pinned: true, // SK AX 자사 콘텐츠는 구독 태그와 무관하게 항상 노출
      summary,
      published_at: args.published ?? null
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

  console.log('등록 완료:', args.title);
  console.log('자동 태깅 결과:', tags.map((t) => `${t.slug}(${t.confidence})`).join(', ') || '없음');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
