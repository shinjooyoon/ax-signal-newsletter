import 'dotenv/config';
import Parser from 'rss-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabase, getLeafTags } from './db.js';
import { tagContent } from './tagger.js';
import { summarizeContent } from './summarizer.js';
import { AFFILIATE_SOURCES } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const configPath = path.join(__dirname, '..', 'config', 'sources.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const feeds = config.rssFeeds.filter((f) => f.enabled);

  if (feeds.length === 0) {
    console.log('활성화된(enabled: true) RSS 소스가 없습니다. config/sources.json을 확인하세요.');
    return;
  }

  const parser = new Parser();
  // dry-run은 DB/Claude API 없이 RSS 파싱만 확인하는 모드
  const supabase = DRY_RUN ? null : getSupabase();
  const leafTags = DRY_RUN ? [] : await getLeafTags(supabase);

  for (const feed of feeds) {
    console.log(`\n[수집 시작] ${feed.name} (${feed.url})`);
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      console.error(`  피드 파싱 실패: ${err.message}`);
      continue;
    }

    console.log(`  ${parsed.items.length}개 항목 발견`);

    for (const item of parsed.items) {
      const title = item.title ?? '(제목 없음)';
      const url = item.link;
      const rawSnippet = item.contentSnippet ?? item.summary ?? '';
      const publishedAt = item.isoDate ?? item.pubDate ?? null;

      if (!url) continue;

      if (DRY_RUN) {
        console.log(`  [dry-run] ${title} -> ${url}`);
        continue;
      }

      // content_items.url이 unique 제약이라 이미 있으면 건너뜀
      const { data: existing } = await supabase
        .from('content_items')
        .select('id')
        .eq('url', url)
        .maybeSingle();
      if (existing) {
        console.log(`  [스킵-중복] ${title}`);
        continue;
      }

      // 원문 스니펫을 그대로 저장/노출하면 저작권 문제가 생기므로 재서술한 요약만 저장한다.
      // 태깅 입력으로는 원문 스니펫이 더 정보량이 많으니 재서술 실패 시 원문을 대신 쓴다(저장은 안 함).
      const summary = await summarizeContent({ title, rawText: rawSnippet });

      const { data: inserted, error: insertError } = await supabase
        .from('content_items')
        .insert({
          title,
          url,
          source: feed.name,
          content_type: 'external',
          summary,
          published_at: publishedAt
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`  저장 실패 (${title}): ${insertError.message}`);
        continue;
      }

      const tags = await tagContent(
        { title, summary: summary ?? rawSnippet },
        leafTags,
        { isAffiliate: AFFILIATE_SOURCES.has(feed.name) }
      );
      if (tags.length > 0) {
        const rows = tags
          .map((t) => {
            const tag = leafTags.find((lt) => lt.slug === t.slug);
            if (!tag) return null;
            return { content_item_id: inserted.id, tag_id: tag.id, confidence: t.confidence };
          })
          .filter(Boolean);

        if (rows.length > 0) {
          const { error: tagError } = await supabase.from('content_tags').insert(rows);
          if (tagError) console.error(`  태깅 저장 실패: ${tagError.message}`);
        }
      }

      console.log(`  [저장 완료] ${title} — 태그: ${tags.map((t) => t.slug).join(', ') || '없음'}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
