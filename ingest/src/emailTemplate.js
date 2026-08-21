import { AFFILIATE_SOURCES } from './constants.js';

// 임채환님 인수인계안(ax-signal-daily.html) 1단계 반영: 위계(오늘의 시그널 1건 강조 +
// SK 소식/뉴스 압축 리스트) + 배지 정리 + 다크모드 + 프리헤더 + 출처명 통일.
// 항목별 AI 재서술 요약과 "오늘의 용어"는 새 스키마/AI 호출이 필요해 2단계로 미룸 —
// 그래서 히어로/압축 아이템 모두 지금은 제목만 보여주고 본문 요약 줄은 없음.

const FONT = "-apple-system,'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

function escapeHtml(str) {
  return (str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

// 매체가 습관적으로 붙이는 "[8월19일]", "[단독]" 같은 대괄호 접두어를 표시용으로만 제거.
// 원본 데이터는 그대로 두고 렌더링 시점에만 잘라내므로 기존 205개 콘텐츠도 백필 없이 바로 적용됨.
function cleanTitle(title) {
  return (title ?? '').replace(/^\s*\[[^\]]{1,30}\]\s*/, '').trim();
}

// SK AX(is_pinned)는 source에 도메인('skax.co.kr')이 들어있어 그대로 노출하면 매체명/도메인이
// 섞여 보이므로 'SK AX'로 통일. 계열사·외부뉴스는 이미 사람이 읽는 이름이 들어있어 그대로 씀.
function displaySource(item) {
  if (item.is_pinned) return 'SK AX';
  return item.source ?? '';
}

// 압축 아이템 요약은 서버에서 강제로 60자 이내로 자른다 — AI가 프롬프트 지시를 안 지키고
// 길게 쓸 때가 있는데, 여기서 두 줄로 넘어가면 히어로와의 위계 차이가 무너진다.
function truncate(str, maxLen) {
  const s = (str ?? '').trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen).trimEnd() + '…';
}

function formatHeaderDate(issueDate) {
  const [y, m, d] = issueDate.split('-').map(Number);
  const weekday = WEEKDAYS_KR[new Date(y, m - 1, d).getDay()];
  return `${m}.${d} (${weekday})`;
}

// 받은편지함 목록 미리보기 문구. 헤드라인 2~3개를 가운뎃점으로 이어붙이고,
// 뒤에 보이지 않는 문자를 채워 클라이언트가 본문 뒷부분을 이어붙여 보여주는 걸 막는다.
function buildPreheader(items) {
  const headlines = items
    .slice(0, 3)
    .map((item) => cleanTitle(item.title))
    .filter(Boolean);
  return headlines.join(' · ');
}

function renderHero(item) {
  if (!item) return '';
  const badge = displaySource(item);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="pad-x" style="padding:26px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-hero" bgcolor="#FFF6F7" style="background-color:#FFF6F7; border-radius:10px;">
          <tr><td class="hero-pad" style="padding:22px 24px 24px 24px;">

            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-family:${FONT}; font-size:11px; font-weight:800; color:#EA002C; letter-spacing:.14em;">오늘의 시그널</td>
            </tr></table>

            ${
              badge
                ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>
              <td class="badge" style="font-family:${FONT}; font-size:11px; font-weight:700; color:#EA002C; border:1px solid #F3B9C3; border-radius:4px; padding:4px 8px;">${escapeHtml(badge)}</td>
            </tr></table>`
                : ''
            }

            <a href="${escapeHtml(item.url)}" class="hero-title t-ink" style="display:block; margin:11px 0 0 0; font-family:${FONT}; font-size:21px; line-height:1.4; font-weight:800; color:#16181D; letter-spacing:-.02em;">
              ${escapeHtml(cleanTitle(item.title))}
            </a>

            ${
              item.summary
                ? `<p class="t-body" style="margin:12px 0 0 0; font-family:${FONT}; font-size:14px; line-height:1.7; color:#5A6172;">${escapeHtml(item.summary)}</p>`
                : ''
            }

          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

function renderCompactItem(item, { labelColor, first }) {
  const label = displaySource(item);
  const divider = first
    ? ''
    : `<tr><td class="pad-x" style="padding:16px 40px 0 40px;"><div class="rule" style="border-top:1px solid #ECEEF2; font-size:0; line-height:0;">&nbsp;</div></td></tr>`;
  return `
    ${divider}
    <tr><td class="pad-x" style="padding:${first ? 18 : 16}px 40px 0 40px;">
      ${label ? `<div style="font-family:${FONT}; font-size:11px; font-weight:700; color:${labelColor}; letter-spacing:.02em;">${escapeHtml(label)}</div>` : ''}
      <a href="${escapeHtml(item.url)}" class="item-title t-ink" style="display:block; margin:5px 0 0 0; font-family:${FONT}; font-size:16px; line-height:1.45; font-weight:700; color:#16181D; letter-spacing:-.01em;">
        ${escapeHtml(cleanTitle(item.title))}
      </a>
      ${
        item.summary
          ? `<p class="t-body" style="margin:5px 0 0 0; font-family:${FONT}; font-size:13px; line-height:1.6; color:#6A7181;">${escapeHtml(truncate(item.summary, 60))}</p>`
          : ''
      }
    </td></tr>`;
}

// SK 소식 = 계열사명을 브랜드 레드 텍스트로, 뉴스 = 매체명을 무채색 텍스트로 —
// 박스형 배지는 히어로에만 쓰고 나머지는 컬러 텍스트 라벨만 써서 위계를 구분한다.
function renderCompactSection(title, items, { titleColor, labelColor }) {
  if (items.length === 0) return '';
  const rows = items.map((item, idx) => renderCompactItem(item, { labelColor, first: idx === 0 })).join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="pad-x" style="padding:32px 40px 0 40px;">
        <div style="font-family:${FONT}; font-size:12px; font-weight:800; color:${titleColor}; letter-spacing:.1em; padding-bottom:9px;">${escapeHtml(title)}</div>
        <div class="rule" style="border-top:2px solid ${titleColor}; font-size:0; line-height:0;">&nbsp;</div>
      </td></tr>
      ${rows}
    </table>`;
}

// 오늘 실린 콘텐츠에서 뽑은 용어 하나 + 뜻풀이. 마땅한 용어가 없는 날은 term이 null이라
// 섹션 자체가 안 보인다(빈 제목줄만 남기지 않기).
function renderTermOfDay(term) {
  if (!term) return '';
  const sourceLink = term.sourceUrl
    ? `<a href="${escapeHtml(term.sourceUrl)}" class="t-mute" style="color:#9AA1B0; text-decoration:underline;">${escapeHtml(term.sourceTitle ?? '')}</a>`
    : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="pad-x" style="padding:32px 40px 0 40px;">
        <div style="font-family:${FONT}; font-size:12px; font-weight:800; color:#FF7A00; letter-spacing:.1em; padding-bottom:9px;">오늘의 용어</div>
        <div class="rule" style="border-top:2px solid #FF7A00; font-size:0; line-height:0;">&nbsp;</div>
      </td></tr>

      <tr><td class="pad-x" style="padding:18px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-term" bgcolor="#FFF8F2" style="background-color:#FFF8F2; border-radius:8px;">
          <tr><td style="padding:18px 20px;">

            <div class="t-ink" style="font-family:${FONT}; font-size:17px; line-height:1.4; font-weight:800; color:#16181D; letter-spacing:-.01em;">
              ${escapeHtml(term.term)}
            </div>
            <p class="t-body" style="margin:9px 0 0 0; font-family:${FONT}; font-size:14px; line-height:1.7; color:#5A6172;">
              ${escapeHtml(term.definition)}
            </p>
            ${
              sourceLink
                ? `<p class="t-mute" style="margin:10px 0 0 0; font-family:${FONT}; font-size:12px; line-height:1.5; color:#9AA1B0;">나온 소식&nbsp;&nbsp;${sourceLink}</p>`
                : ''
            }

          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

/**
 * 개인화 다이제스트 이메일 HTML을 만든다. 이메일 클라이언트 호환을 위해 인라인 스타일 위주로 작성하고,
 * 다크모드는 <style> 블록(prefers-color-scheme + Outlook.com용 [data-ogsc])으로 별도 처리한다.
 * 오늘의 시그널(히어로) 1건을 강조하고, 나머지는 SK 소식/뉴스로 나눠 압축 리스트로 보여준다.
 * 배경/글자색은 항상 쌍으로 인라인 지정한다 — 한쪽만 지정하면 클라이언트 자체 다크모드가
 * 상속된 기본 글자색만 반전시켜 흰 글씨/밝은 배경처럼 안 보이는 조합이 생길 수 있다.
 * @param {{ subscriberName?: string, issueDate: string, items: Array<{title:string,url:string,source?:string,is_pinned?:boolean,summary?:string}>, weather?: {icon:string,tempMax:number,tempMin:number,blurb:string}|null, emptyTagNames?: string[], baseUrl?: string, digestToken?: string, term?: {term:string,definition:string,sourceTitle?:string,sourceUrl?:string}|null }} params
 */
export function buildDigestHtml({
  subscriberName,
  issueDate,
  items,
  weather,
  emptyTagNames = [],
  baseUrl = 'https://ax-signal-newsletter.vercel.app',
  digestToken,
  term
}) {
  const greeting = pickGreeting(subscriberName);
  const preheader = buildPreheader(items);
  const headerDate = formatHeaderDate(issueDate);

  const hero = items[0] ?? null;
  const rest = items.slice(1);
  const skItems = rest.filter((item) => item.is_pinned || AFFILIATE_SOURCES.has(item.source));
  const externalItems = rest.filter((item) => !item.is_pinned && !AFFILIATE_SOURCES.has(item.source));

  const weatherHtml = weather
    ? `<div class="bg-weather t-body" style="background:#f3f4f6;color:#374151;border-radius:8px;padding:10px 14px;font-size:13px;margin:16px 0 0 0;">${escapeHtml(weather.blurb)}</div>`
    : '';

  // 구독자가 고른 태그인데 오늘은 SK 계열사 소식이 없었던 것들을 명시적으로 알려준다 (조용히 빠지지 않게)
  // 뉴스 섹션은 태그 무관 공유 큐라 여기 해당 안 됨 — 계열사(SK 소식)에 한정된 안내.
  const emptyTagHtml =
    emptyTagNames.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="pad-x" style="padding:12px 40px 0 40px;">
            <p class="t-mute" style="margin:0; font-family:${FONT}; font-size:13px; color:#9AA1B0;">오늘은 ${emptyTagNames.map(escapeHtml).join(', ')} 관련 SK 계열사 소식이 없어요.</p>
          </td></tr>
        </table>`
      : '';

  const fallbackHtml =
    items.length === 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="pad-x" style="padding:26px 40px 0 40px;">
            <p class="t-body" style="margin:0; font-family:${FONT}; font-size:14px; line-height:1.7; color:#5A6172;">오늘은 조용한 날이에요. 새로운 소식이 모이면 다시 보내드릴게요.</p>
          </td></tr>
        </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="ko" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>AX Signal — ${escapeHtml(issueDate)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  @media (prefers-color-scheme: dark) {
    .bg-page    { background-color:#0E1014 !important; }
    .bg-card    { background-color:#171A20 !important; }
    .bg-hero    { background-color:#1F1418 !important; }
    .bg-weather { background-color:#232733 !important; }
    .bg-term    { background-color:#21190F !important; }
    .t-ink      { color:#F2F4F7 !important; }
    .t-body     { color:#C3C9D4 !important; }
    .t-mute     { color:#8E96A5 !important; }
    .rule       { border-color:#2B313B !important; }
    .badge      { border-color:#5C2733 !important; }
  }
  [data-ogsc] .bg-page    { background-color:#0E1014 !important; }
  [data-ogsc] .bg-card    { background-color:#171A20 !important; }
  [data-ogsc] .bg-hero    { background-color:#1F1418 !important; }
  [data-ogsc] .bg-weather { background-color:#232733 !important; }
  [data-ogsc] .bg-term    { background-color:#21190F !important; }
  [data-ogsc] .t-ink      { color:#F2F4F7 !important; }
  [data-ogsc] .t-body     { color:#C3C9D4 !important; }
  [data-ogsc] .t-mute     { color:#8E96A5 !important; }
  [data-ogsc] .rule       { border-color:#2B313B !important; }

  a { text-decoration:none; }
  @media screen and (max-width:600px) {
    .pad-x { padding-left:20px !important; padding-right:20px !important; }
    .hero-pad { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:22px !important; }
    .hero-title { font-size:20px !important; }
    .item-title { font-size:16px !important; }
  }
</style>
</head>

<body class="bg-page" style="margin:0; padding:0; background-color:#F4F5F7; -webkit-font-smoothing:antialiased;">

<div style="display:none; font-size:1px; color:#F4F5F7; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
  ${escapeHtml(preheader)}
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" bgcolor="#F4F5F7" style="background-color:#F4F5F7;">
<tr><td align="center" style="padding:24px 12px 40px 12px;">
  <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:680px; max-width:680px;">

  <tr><td style="padding:8px 4px 18px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" style="font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:.18em; color:#EA002C; white-space:nowrap;">&#9679;&nbsp; AX SIGNAL</td>
      <td align="right" class="t-mute" style="font-family:${FONT}; font-size:12px; color:#8A90A0; white-space:nowrap;">${escapeHtml(headerDate)}${weather ? ` &nbsp;&#183;&nbsp; ${weather.icon} ${weather.tempMin}&#176;/${weather.tempMax}&#176;` : ''}</td>
    </tr></table>
  </td></tr>

  <tr><td style="font-size:0; line-height:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="55%" bgcolor="#EA002C" height="4" style="height:4px; font-size:0; line-height:0;">&nbsp;</td>
      <td width="45%" bgcolor="#FF7A00" height="4" style="height:4px; font-size:0; line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td class="bg-card" bgcolor="#FFFFFF" style="background-color:#FFFFFF;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="pad-x" style="padding:34px 40px 0 40px;">
        <h1 class="h1 t-ink" style="margin:0; font-family:${FONT}; font-size:24px; line-height:1.35; font-weight:800; color:#16181D; letter-spacing:-.02em;">
          ${greeting}
        </h1>
        <p class="t-body" style="margin:10px 0 0 0; font-family:${FONT}; font-size:15px; line-height:1.65; color:#5A6172;">
          오늘의 AI/AX 소식을 모아왔어요.
        </p>
        ${weatherHtml}
      </td></tr>
    </table>

    ${renderHero(hero)}
    ${renderCompactSection('SK 소식', skItems, { titleColor: '#EA002C', labelColor: '#EA002C' })}
    ${renderCompactSection('뉴스', externalItems, { titleColor: '#2E5BFF', labelColor: '#9AA1B0' })}
    ${emptyTagHtml}
    ${fallbackHtml}
    ${renderTermOfDay(term)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="height:40px; font-size:0; line-height:0;">&nbsp;</td></tr>
    </table>
  </td></tr>

  <tr><td class="pad-x" style="padding:22px 40px 0 40px;" align="center">
    <p class="t-mute" style="margin:0; font-family:${FONT}; font-size:12px; line-height:1.7; color:#9AA1B0;">
      평일 아침 7시에 보내드려요<br>
      AX Signal — 관심 산업 분야 기반 AI/AX 뉴스레터
    </p>
    ${
      digestToken
        ? `<p style="margin:13px 0 0 0; font-family:${FONT}; font-size:12px; line-height:1.7;">
      <a href="${escapeHtml(baseUrl)}/" class="t-mute" style="color:#9AA1B0; text-decoration:underline;">관심 분야 바꾸기</a>
      <span class="t-mute" style="color:#C6CBD4;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
      <a href="${escapeHtml(baseUrl)}/unsubscribe/${escapeHtml(digestToken)}" class="t-mute" style="color:#9AA1B0; text-decoration:underline;">구독 해지</a>
    </p>`
        : ''
    }
  </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
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
