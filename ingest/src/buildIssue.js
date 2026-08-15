import 'dotenv/config';
import crypto from 'node:crypto';
import { getSupabase, getMatchedContent } from './db.js';
import { summarizeDigest } from './tagger.js';

// 특정 발송 회차(issue)에 대해 구독자별 개인화 콘텐츠를 매칭하고,
// 상단 요약 불릿을 생성해 sends 테이블에 저장한다.
// schema.sql 하단에 남겨둔 매칭 쿼리(구독 태그 + is_pinned 콘텐츠)를 실제로 구현한 것.
//
// 매칭되는 전체 콘텐츠를 다 보내면 뉴스레터가 너무 길어지므로, 한 회차당
// 외부 뉴스 최신 MAX_EXTERNAL개 + SK 계열사 최신 MAX_AFFILIATE개 + SK AX 최신 MAX_PINNED개만 골라서 보낸다.
// 이번에 선택 안 된 나머지는 "이미 보낸 것"으로 기록하지 않으므로, 다음 회차에서
// 여전히 최신 축에 들면 다시 후보로 올라올 수 있다.
//
// [미승인 제안] SK 계열사 소식을 별도 슬롯으로 분리 — RSS가 있는 곳부터(하이닉스/텔레콤).
// docs/proposal-sk-affiliate-rotation.md 참고, 계열사-태그 매핑은 별도 테이블 없이
// content_items.source가 이 목록에 있으면 "계열사"로, 아니면 "외부뉴스"로 취급한다.
const AFFILIATE_SOURCES = new Set(['SK하이닉스', 'SK텔레콤']);
const MAX_EXTERNAL = 2;
const MAX_AFFILIATE = 1;
const MAX_PINNED = 1;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = (args[i] ?? '').replace(/^--/, '');
    out[key] = args[i + 1];
  }
  return out;
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

  for (const subscriber of subscribers) {
    const { data: existingSend } = await supabase
      .from('sends')
      .select('id')
      .eq('issue_id', issue.id)
      .eq('subscriber_id', subscriber.id)
      .maybeSingle();
    if (existingSend) {
      console.log(`  [스킵-이미 존재] ${subscriber.email}`);
      continue;
    }

    // excludeSent(기본 true) — 이전 발송에서 이미 보낸 콘텐츠(특히 is_pinned SK AX)는 다시 안 보냄
    const matched = await getMatchedContent(supabase, subscriber.id);
    if (matched.length === 0) {
      console.log(`  [새 콘텐츠 없음-스킵] ${subscriber.email}`);
      continue;
    }

    // matched는 is_pinned desc, 날짜 desc로 정렬돼 있으므로 앞쪽이 pinned(SK AX) 그룹
    const pinned = matched.filter((item) => item.is_pinned).slice(0, MAX_PINNED);
    const affiliate = matched
      .filter((item) => !item.is_pinned && AFFILIATE_SOURCES.has(item.source))
      .slice(0, MAX_AFFILIATE);
    const external = matched
      .filter((item) => !item.is_pinned && !AFFILIATE_SOURCES.has(item.source))
      .slice(0, MAX_EXTERNAL);
    const selected = [...pinned, ...affiliate, ...external];

    if (selected.length === 0) {
      console.log(`  [새 콘텐츠 없음-스킵] ${subscriber.email}`);
      continue;
    }

    const bullets = await summarizeDigest(selected);

    const { data: send, error: sendError } = await supabase
      .from('sends')
      .insert({
        issue_id: issue.id,
        subscriber_id: subscriber.id,
        channel: 'email',
        digest_token: crypto.randomUUID(),
        summary_bullets: bullets
      })
      .select('id')
      .single();
    if (sendError) {
      console.error(`  [저장 실패] ${subscriber.email}: ${sendError.message}`);
      continue;
    }

    const sentContentRows = selected.map((item) => ({
      subscriber_id: subscriber.id,
      content_item_id: item.id,
      send_id: send.id
    }));
    const { error: sentContentError } = await supabase
      .from('subscriber_sent_content')
      .insert(sentContentRows);
    if (sentContentError) {
      console.error(`  [발송 이력 기록 실패] ${subscriber.email}: ${sentContentError.message}`);
    }

    console.log(`  [매칭 완료] ${subscriber.email} — 선택 ${selected.length}개(SK AX ${pinned.length} + 계열사 ${affiliate.length} + 뉴스 ${external.length}) / 매칭 후보 ${matched.length}개, 불릿 ${bullets.length}개`);
    bullets.forEach((b) => console.log(`    - ${b}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
