import 'dotenv/config';
import crypto from 'node:crypto';
import {
  getSupabase,
  getPinnedPick,
  getTagPicks,
  getExternalNewsPicks,
  markPinnedUsed,
  markTagUsed,
  markExternalNewsUsed
} from './db.js';

// 특정 발송 회차(issue)에 대해 콘텐츠를 골라 sends 테이블에 저장한다.
//
// [미승인 제안] "같은 태그를 고른 구독자는 언제 가입했든 전부 같은 콘텐츠를 받는다" 구조.
// 구독자마다 따로 진행 상황(FIFO)을 추적하는 대신, SK AX는 전체 공유 큐 1개,
// 태그별로 공유 큐 1개씩을 두고 이번 회차에 각 큐에서 다음 걸 한 번만 뽑는다.
// 그 뽑힌 콘텐츠를, 그 태그를 고른 모든 구독자에게 동일하게 나눠준다.
// docs/proposal-sk-affiliate-rotation.md 참고.

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = (args[i] ?? '').replace(/^--/, '');
    // --force처럼 값 없는 플래그도 처리 (다음 토큰이 또 --로 시작하거나 없으면 값을 안 먹음)
    if (args[i + 1] === undefined || args[i + 1].startsWith('--')) {
      out[key] = true;
      i -= 1;
    } else {
      out[key] = args[i + 1];
    }
  }
  return out;
}

// 발송은 평일에만 한다 (토/일 제외). issueDate는 "YYYY-MM-DD" 문자열이라
// new Date(issueDate)로 바로 파싱하면 타임존에 따라 날짜가 밀릴 수 있어서 직접 분해해서 만든다.
function isWeekend(issueDate) {
  const [y, m, d] = issueDate.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0=일, 6=토
  return day === 0 || day === 6;
}

async function getOrCreateIssue(supabase, issueDate) {
  const { data: existing } = await supabase
    .from('issues')
    .select('id, issue_date, status')
    .eq('issue_date', issueDate)
    .maybeSingle();
  if (existing) return existing;

  const { data: inserted, error } = await supabase
    .from('issues')
    .insert({ issue_date: issueDate })
    .select('id, issue_date, status')
    .single();
  if (error) throw error;
  return inserted;
}

async function main() {
  const args = parseArgs();
  const issueDate = args.date ?? new Date().toISOString().slice(0, 10);

  if (isWeekend(issueDate) && !args.force) {
    console.log(`${issueDate}은 주말이라 발송하지 않습니다 (--force로 강제 실행 가능).`);
    return;
  }

  const supabase = getSupabase();
  const issue = await getOrCreateIssue(supabase, issueDate);
  console.log(`[발송 회차] ${issue.issue_date} (issue_id: ${issue.id}, status: ${issue.status})`);

  const { data: subscribers, error: subError } = await supabase
    .from('subscribers')
    .select('id, email, name')
    .eq('status', 'active');
  if (subError) throw subError;

  if (!subscribers || subscribers.length === 0) {
    console.log('활성 구독자가 없습니다.');
    return;
  }

  // 이미 이번 회차를 받은 구독자는 제외 (재실행해도 공유 큐가 또 안 넘어가게)
  const pending = [];
  for (const subscriber of subscribers) {
    const { data: existingSend } = await supabase
      .from('sends')
      .select('id')
      .eq('issue_id', issue.id)
      .eq('subscriber_id', subscriber.id)
      .maybeSingle();
    if (existingSend) {
      console.log(`  [스킵-이미 존재] ${subscriber.email}`);
    } else {
      pending.push(subscriber);
    }
  }

  if (pending.length === 0) {
    console.log('모든 구독자가 이미 이번 회차를 받았습니다.');
    return;
  }

  // SK AX는 전체 공유 — 이번 회차에 한 번만 뽑는다
  const pinnedPick = await getPinnedPick(supabase);
  if (pinnedPick) {
    await markPinnedUsed(supabase, pinnedPick.id);
    console.log(`[SK AX 공유 픽] ${pinnedPick.title}`);
  } else {
    console.log('[SK AX 공유 픽] 새 콘텐츠 없음');
  }

  // 외부뉴스도 태그 무관하게 전체 공유 — 이번 회차에 한 번만 2개 뽑는다
  const externalNewsPicks = await getExternalNewsPicks(supabase, 2);
  if (externalNewsPicks.length > 0) {
    await markExternalNewsUsed(
      supabase,
      externalNewsPicks.map((item) => item.id)
    );
  }
  console.log(`[뉴스 공유 픽] ${externalNewsPicks.length}개`);

  // 이번에 발송 대상인 구독자들이 고른 태그만 모아서, 태그별로 SK 계열사 픽을 한 번씩만 뽑는다
  const { data: allSubTags } = await supabase
    .from('subscriber_tags')
    .select('tag_id')
    .in(
      'subscriber_id',
      pending.map((s) => s.id)
    );
  const uniqueTagIds = [...new Set((allSubTags ?? []).map((r) => r.tag_id))];

  const tagPicksById = new Map();
  for (const tagId of uniqueTagIds) {
    const picks = await getTagPicks(supabase, tagId);
    tagPicksById.set(tagId, picks);
    await markTagUsed(
      supabase,
      tagId,
      picks.affiliate.map((item) => item.id)
    );
    console.log(`[태그 공유 픽] ${tagId} — 계열사 ${picks.affiliate.length}`);
  }

  // 구독자별로 sends 생성 — 같은 태그를 고른 사람은 전부 같은 콘텐츠를 받는다
  for (const subscriber of pending) {
    const { data: subTags } = await supabase.from('subscriber_tags').select('tag_id').eq('subscriber_id', subscriber.id);
    const tagIds = (subTags ?? []).map((t) => t.tag_id);

    const selected = [];
    const tagByItemId = new Map(); // item.id -> 이 아이템을 고르게 한 tag_id (SK AX/외부뉴스는 null)
    if (pinnedPick) {
      selected.push(pinnedPick);
      tagByItemId.set(pinnedPick.id, null);
    }
    for (const item of externalNewsPicks) {
      if (!tagByItemId.has(item.id)) {
        selected.push(item);
        tagByItemId.set(item.id, null);
      }
    }
    for (const tagId of tagIds) {
      const picks = tagPicksById.get(tagId);
      if (!picks) continue;
      for (const item of picks.affiliate) {
        if (!tagByItemId.has(item.id)) {
          selected.push(item);
          tagByItemId.set(item.id, tagId);
        }
      }
    }

    if (selected.length === 0) {
      console.log(`  [새 콘텐츠 없음-스킵] ${subscriber.email}`);
      continue;
    }

    const { data: send, error: sendError } = await supabase
      .from('sends')
      .insert({
        issue_id: issue.id,
        subscriber_id: subscriber.id,
        channel: 'email',
        digest_token: crypto.randomUUID()
      })
      .select('id')
      .single();
    if (sendError) {
      console.error(`  [저장 실패] ${subscriber.email}: ${sendError.message}`);
      continue;
    }

    // upsert — 공유 큐가 예전(구독자별 추적 시절) 기록과 같은 콘텐츠를 다시 고를 수도 있어서,
    // 이 send_id로 갱신되게 한다 (subscriber_sent_content는 이제 "이번에 뭘 보냈는지" 조회용).
    const sentContentRows = selected.map((item) => ({
      subscriber_id: subscriber.id,
      content_item_id: item.id,
      send_id: send.id,
      tag_id: tagByItemId.get(item.id) ?? null
    }));
    const { error: sentContentError } = await supabase
      .from('subscriber_sent_content')
      .upsert(sentContentRows, { onConflict: 'subscriber_id,content_item_id' });
    if (sentContentError) {
      console.error(`  [발송 이력 기록 실패] ${subscriber.email}: ${sentContentError.message}`);
    }

    console.log(`  [매칭 완료] ${subscriber.email} — 콘텐츠 ${selected.length}개 (태그 ${tagIds.length}개 기준)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
