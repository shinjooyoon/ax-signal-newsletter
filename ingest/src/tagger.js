import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 모델 ID는 시점에 따라 바뀌므로, 실행 전에 docs.claude.com/en/docs/about-claude/models
// 에서 현재 사용 가능한 최신 모델명으로 한 번 확인하고 넣어주세요.
const MODEL = 'claude-sonnet-5';

const TAG_TOOL = {
  name: 'assign_tags',
  description: '주어진 콘텐츠에 해당하는 태그와 신뢰도를 반환합니다.',
  input_schema: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        description: '이 콘텐츠에 해당하는 태그들. 애매하면 넣지 않는다 (0개도 가능).',
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: '태그 목록에 있는 slug 값 그대로' },
            confidence: { type: 'number', description: '0.00 ~ 1.00 사이 신뢰도' }
          },
          required: ['slug', 'confidence']
        }
      }
    },
    required: ['tags']
  }
};

/**
 * 콘텐츠 제목/요약을 보고 해당하는 태그를 판단한다.
 * @param {{title: string, summary?: string}} content
 * @param {{slug: string, name: string}[]} availableTags - 후보 태그 목록 (리프 태그만)
 * @param {{isAffiliate?: boolean}} [options] - SK 계열사(자사) 콘텐츠면 true. "SK 소식" 섹션은
 *   구독자가 관심 산업의 SK 계열사 동향을 파악하려는 목적이라 AI 관련성을 요구하지 않는다.
 *   반면 태그 무관 공유 "뉴스" 풀은 AI/AX 뉴스레터라는 정체성을 지켜야 해서 계속 AI 관련성을
 *   요구한다(isAffiliate=false, 기본값) — 이 구분이 없으면 태양광 설치 뉴스 같은 AI 무관
 *   콘텐츠가 "일반 AI 트렌드"에 잘못 붙는 예전 버그가 재발한다.
 * @returns {Promise<{slug: string, confidence: number}[]>}
 */
export async function tagContent(content, availableTags, { isAffiliate = false } = {}) {
  if (!availableTags || availableTags.length === 0) return [];

  const tagList = availableTags.map((t) => `- ${t.slug}: ${t.name}`).join('\n');

  const relevanceRule = isAffiliate
    ? `이 콘텐츠는 SK 계열사(자사)가 직접 낸 소식이다. 구독자는 관심 산업 분야의 SK 계열사
동향(사업/실적/제품/행사 등)을 파악하려는 목적으로 태그를 골랐으니, AI와 관련 없어도 된다.
그 계열사의 실제 사업 분야에 맞는 산업 태그를 붙여라(예: 반도체 회사 소식이면 AI 언급이 없어도
"반도체" 태그를 붙인다). 다만 그 산업과 명백히 무관한 태그는 붙이지 마라. "일반 AI 트렌드"는
특정 산업에 안 묶이는 일반적인 AI 기술/시장 소식일 때만 써라.`
    : `이 뉴스레터는 AI/AX(AI Transformation) 관련 소식만 다룬다. 아래 콘텐츠가
AI·인공지능·생성형AI 기술과 실질적으로 관련이 있으면서, 동시에 아래 태그 목록 중
어느 산업 분야에도 해당하는지 판단해줘.

주의: 태그 이름이 "반도체/에너지/화학/헬스케어" 같은 산업명이라고 해서, 그 산업에 관한
뉴스면 무조건 해당되는 게 아니다. **AI와 무관한 순수 산업/사업/ESG/사회공헌 뉴스는 태그를
붙이지 마라** (예: 단순 투자 유치, 봉사활동, 태양광 설치 같은 AI와 상관없는 산업 뉴스는 제외).
"일반 AI 트렌드"는 특정 산업에 안 묶이는 일반적인 AI 기술/시장 소식에만 써라.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [TAG_TOOL],
    tool_choice: { type: 'tool', name: 'assign_tags' },
    messages: [
      {
        role: 'user',
        content: `${relevanceRule}

명확하게 관련 있는 태그만 골라서 반환하고, 하나도 해당 안 되면 빈 배열을 반환해.

[태그 목록]
${tagList}

[콘텐츠]
제목: ${content.title}
요약: ${content.summary ?? '(없음)'}`
      }
    ]
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse) return [];
  return toolUse.input.tags ?? [];
}

const DIGEST_TOOL = {
  name: 'summarize_digest',
  description: '뉴스레터 상단에 노출할 핵심 요약 불릿을 반환합니다.',
  input_schema: {
    type: 'object',
    properties: {
      bullets: {
        type: 'array',
        description: '3~5개의 짧은 요약 불릿 (각각 한 문장)',
        items: { type: 'string' }
      }
    },
    required: ['bullets']
  }
};

/**
 * 구독자에게 매칭된 콘텐츠 목록을 3~5개 불릿으로 요약한다.
 * @param {{title: string, summary?: string}[]} items
 * @returns {Promise<string[]>}
 */
export async function summarizeDigest(items) {
  if (!items || items.length === 0) return [];

  const list = items
    .map((it, i) => `${i + 1}. ${it.title}${it.summary ? ' - ' + it.summary : ''}`)
    .join('\n');

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [DIGEST_TOOL],
    tool_choice: { type: 'tool', name: 'summarize_digest' },
    messages: [
      {
        role: 'user',
        content: `다음은 이번 다이제스트에 포함될 콘텐츠 목록이다. 이 중 핵심만 골라 3~5개의 짧은 불릿으로 요약해줘.
각 불릿은 한 문장, 클릭하고 싶어지게 간결하게.

${list}`
      }
    ]
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse) return [];
  return toolUse.input.bullets ?? [];
}
