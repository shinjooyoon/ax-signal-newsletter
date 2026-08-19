// SK AX처럼 is_pinned은 아닌 SK 계열사 소스(RSS 자동 수집 + 수동 등록 둘 다 포함) —
// buildIssue.js와 emailTemplate.js 둘 다에서 "SK 소식" 섹션으로 묶을 때 기준으로 쓴다.
// SK바이오팜, SK엔무브, SK스퀘어, SK실트론(2년 이상 미갱신), SK가스, SK브로드밴드는
// 개별 기사 고유 URL이 없거나(SPA) 뉴스 섹션 자체가 없어서 제외 —
// docs/proposal-sk-affiliate-rotation.md 참고.
export const AFFILIATE_SOURCES = new Set([
  'SK하이닉스',
  'SK텔레콤',
  'SK이노베이션·E&S', // SK이노베이션, SK지오센트릭, SK아이이테크놀로지 소식도 이 뉴스룸에 같이 올라옴
  'SK네트웍스',
  'SKC',
  'SK에코플랜트',
  'SK주식회사',
  'SK케미칼', // SK디스커버리 그룹
  'SK바이오사이언스'
]);
