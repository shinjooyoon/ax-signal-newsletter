// SK AX처럼 is_pinned은 아닌 SK 계열사 소스(RSS 자동 수집 + 수동 등록 둘 다 포함) —
// buildIssue.js와 emailTemplate.js 둘 다에서 "SK 소식" 섹션으로 묶을 때 기준으로 쓴다.
// SK바이오팜은 개별 기사에 고유 URL이 없는 SPA라(list.do 하나로 고정) 제외 —
// docs/proposal-sk-affiliate-rotation.md 참고.
export const AFFILIATE_SOURCES = new Set(['SK하이닉스', 'SK텔레콤', 'SK이노베이션·E&S']);
