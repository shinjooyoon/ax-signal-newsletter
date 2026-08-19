import 'dotenv/config';
import { Resend } from 'resend';
import { getSupabase, getContentForSend, getEmptyTagNames, todayKST } from './db.js';
import { buildDigestHtml } from './emailTemplate.js';
import { getWeatherBlurb } from './weather.js';

// 5단계(buildIssue.js)에서 만든 sends를 실제 이메일로 발송한다.
// 아직 발신 도메인 인증 전이면 RESEND_FROM_EMAIL을 onboarding@resend.dev로 두고
// 계정 소유자 본인 이메일로만 테스트 발송하세요.

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = (args[i] ?? '').replace(/^--/, '');
    out[key] = args[i + 1];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const issueDate = args.date ?? todayKST();

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY 환경변수가 필요합니다. .env에 추가해주세요.');
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const resend = new Resend(process.env.RESEND_API_KEY);

  const supabase = getSupabase();

  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('id, issue_date')
    .eq('issue_date', issueDate)
    .maybeSingle();
  if (issueError) throw issueError;
  if (!issue) {
    console.log(`${issueDate} 발송 회차가 없습니다. 먼저 npm run build:issue를 실행하세요.`);
    return;
  }

  const { data: sends, error: sendsError } = await supabase
    .from('sends')
    .select('id, subscriber_id, digest_token, subscribers(email, name)')
    .eq('issue_id', issue.id)
    .eq('channel', 'email')
    .is('sent_at', null);
  if (sendsError) throw sendsError;

  if (!sends || sends.length === 0) {
    console.log('발송 대기 중인 이메일이 없습니다 (이미 다 보냈거나 매칭된 send가 없음).');
    return;
  }

  const weatherBlurb = await getWeatherBlurb(); // 판교 기준, 모든 구독자 공통 (오늘 알릴 게 없으면 null)
  if (weatherBlurb) console.log(`[날씨] ${weatherBlurb}`);

  for (const send of sends) {
    const subscriber = send.subscribers;
    // buildIssue.js가 이 send에 실제로 매칭해 넣었던 콘텐츠 그대로 재사용 (재계산하지 않음)
    const matched = await getContentForSend(supabase, send.id);
    // 구독자가 고른 태그인데 오늘은 새 콘텐츠가 하나도 없었던 것들 — 이메일에 "없다"고 명시
    const emptyTagNames = await getEmptyTagNames(supabase, send.subscriber_id, send.id);

    const html = buildDigestHtml({
      subscriberName: subscriber.name,
      issueDate: issue.issue_date,
      items: matched.slice(0, 8),
      weatherBlurb,
      emptyTagNames
    });

    try {
      const { data, error } = await resend.emails.send({
        from: `AX Signal <${fromEmail}>`,
        to: subscriber.email,
        subject: `[AX Signal] ${issue.issue_date} 다이제스트`,
        html
      });
      if (error) {
        console.error(`  [발송 실패] ${subscriber.email}: ${error.message}`);
        continue;
      }

      await supabase.from('sends').update({ sent_at: new Date().toISOString() }).eq('id', send.id);
      console.log(`  [발송 완료] ${subscriber.email} (resend id: ${data.id})`);
    } catch (err) {
      console.error(`  [발송 실패] ${subscriber.email}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
