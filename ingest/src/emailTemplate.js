import { AFFILIATE_SOURCES } from './constants.js';

function escapeHtml(str) {
  return (str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function renderBadge(text, color, bg) {
  return `<span style="display:inline-block;font-size:11px;font-weight:600;color:${color};background:${bg};border-radius:4px;padding:2px 6px;margin-right:6px;">${escapeHtml(text)}</span>`;
}

function renderItem(item) {
  const badges = [
    item.is_pinned ? renderBadge('SK AX', '#b45309', '#fef3c7') : '',
    // 어떤 관심 분야(태그) 때문에 이 콘텐츠가 선택됐는지 SK AX 배지와 같은 스타일로 표시
    item.tagName ? renderBadge(item.tagName, '#1e40af', '#dbeafe') : ''
  ].join('');
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;">
        ${badges}
        <a href="${escapeHtml(item.url)}" style="color:#111;font-weight:600;text-decoration:none;font-size:15px;">${escapeHtml(item.title)}</a>
        ${item.source ? `<div style="color:#888;font-size:12px;margin-top:4px;">${escapeHtml(item.source)}</div>` : ''}
      </td>
    </tr>`;
}

// 박스 없이, 진한 색 글씨 + 굵은 밑줄로만 섹션을 구분한다.
function renderSection(title, items, titleColor) {
  if (items.length === 0) return '';
  return `
    <div style="font-size:14px;font-weight:800;color:${titleColor};letter-spacing:0.02em;margin:24px 0 8px;padding-bottom:6px;border-bottom:3px solid ${titleColor};">
      ${escapeHtml(title)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${items.map(renderItem).join('')}
    </table>`;
}

// 매 발송마다 랜덤으로 골라 쓰는 긍정적인 인사말 — {name}은 실제 이름으로 치환됨.
// 이모지 포함 여부가 섞여 있어도 되도록 톤을 통일(과하지 않게, 응원/긍정 느낌)해뒀다.
const GREETING_TEMPLATES = [
  (name) => `${name}님, 좋은 아침이에요 ☀️`,
  (name) => `${name}님, 오늘도 화이팅이에요 💪`,
  (name) => `좋은 아침이에요, ${name}님 🌤️`,
  (name) => `${name}님, 상쾌한 하루 시작해봐요`,
  (name) => `${name}님, 오늘도 좋은 하루 보내세요`,
  (name) => `${name}님, 활기찬 아침이에요 🙌`,
  (name) => `${name}님, 오늘 하루도 응원할게요`,
  (name) => `안녕하세요 ${name}님, 새로운 하루가 밝았어요`,
  (name) => `${name}님, 커피 한 잔과 함께 시작해봐요 ☕`,
  (name) => `${name}님, 오늘도 좋은 소식 가득하길 바라요`
];

function pickGreeting(subscriberName) {
  const safeName = escapeHtml(subscriberName || '구독자');
  const template = GREETING_TEMPLATES[Math.floor(Math.random() * GREETING_TEMPLATES.length)];
  return template(safeName);
}

/**
 * 개인화 다이제스트 이메일 HTML을 만든다. 이메일 클라이언트 호환을 위해 인라인 스타일만 사용.
 * SK 관련(AX 고정 + 계열사)과 관심 분야 외부뉴스를 시각적으로 구분된 두 섹션으로 나눈다.
 * 인사말은 매 발송마다 랜덤으로 골라 딱딱하지 않게 응원하는 톤으로 바뀐다.
 * @param {{ subscriberName?: string, issueDate: string, items: Array<{title:string,url:string,source?:string,is_pinned?:boolean}>, weatherBlurb?: string|null, emptyTagNames?: string[] }} params
 */
export function buildDigestHtml({ subscriberName, issueDate, items, weatherBlurb, emptyTagNames = [] }) {
  const greeting = pickGreeting(subscriberName);

  const weatherHtml = weatherBlurb
    ? `<div style="background:#f3f4f6;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:20px;">${escapeHtml(weatherBlurb)}</div>`
    : '';

  const skItems = items.filter((item) => item.is_pinned || AFFILIATE_SOURCES.has(item.source));
  const externalItems = items.filter((item) => !item.is_pinned && !AFFILIATE_SOURCES.has(item.source));

  // 구독자가 고른 태그인데 오늘은 SK 계열사 소식이 없었던 것들을 명시적으로 알려준다 (조용히 빠지지 않게)
  // 뉴스 섹션은 태그 무관 공유 큐라 여기 해당 안 됨 — 계열사(SK 소식)에 한정된 안내.
  const emptyTagHtml =
    emptyTagNames.length > 0
      ? `<div style="color:#999;font-size:13px;margin:8px 0 20px;">오늘은 ${emptyTagNames.map(escapeHtml).join(', ')} 관련 SK 계열사 소식이 없어요.</div>`
      : '';

  return `
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <div style="font-size:13px;color:#888;margin-bottom:4px;">AX Signal · ${escapeHtml(issueDate)}</div>
    <h1 style="font-size:20px;margin:0 0 4px;">${greeting}</h1>
    <p style="font-size:14px;color:#666;margin:0 0 16px;">오늘의 AI/AX 소식을 모아왔어요</p>

    ${weatherHtml}

    ${renderSection('SK 소식', skItems, '#c81e2c')}
    ${renderSection('뉴스', externalItems, '#1d4ed8')}
    ${emptyTagHtml}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:12px;">
      AX Signal — 관심 산업 분야 기반 AI/AX 뉴스레터
    </div>
  </div>`;
}
