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

function renderItem(item) {
  const badge = item.is_pinned
    ? '<span style="display:inline-block;font-size:11px;font-weight:600;color:#b45309;background:#fef3c7;border-radius:4px;padding:2px 6px;margin-right:6px;">SK AX</span>'
    : '';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;">
        ${badge}
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

/**
 * 개인화 다이제스트 이메일 HTML을 만든다. 이메일 클라이언트 호환을 위해 인라인 스타일만 사용.
 * SK 관련(AX 고정 + 계열사)과 관심 분야 외부뉴스를 시각적으로 구분된 두 섹션으로 나눈다.
 * @param {{ subscriberName?: string, issueDate: string, items: Array<{title:string,url:string,source?:string,is_pinned?:boolean}>, weatherBlurb?: string|null }} params
 */
export function buildDigestHtml({ subscriberName, issueDate, items, weatherBlurb }) {
  const greeting = subscriberName ? `${escapeHtml(subscriberName)}님,` : '안녕하세요,';

  const weatherHtml = weatherBlurb
    ? `<div style="background:#f3f4f6;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:20px;">${escapeHtml(weatherBlurb)}</div>`
    : '';

  const skItems = items.filter((item) => item.is_pinned || AFFILIATE_SOURCES.has(item.source));
  const externalItems = items.filter((item) => !item.is_pinned && !AFFILIATE_SOURCES.has(item.source));

  return `
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <div style="font-size:13px;color:#888;margin-bottom:4px;">AX Signal · ${escapeHtml(issueDate)}</div>
    <h1 style="font-size:20px;margin:0 0 16px;">${greeting} 이번 주 AI/AX 소식이에요</h1>

    ${weatherHtml}

    ${renderSection('SK 소식', skItems, '#c81e2c')}
    ${renderSection('관심 분야 뉴스', externalItems, '#1d4ed8')}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:12px;">
      AX Signal — 관심 산업 분야 기반 AI/AX 뉴스레터
    </div>
  </div>`;
}
