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
 * @returns {Promise<{slug: string, confidence: number}[]>}
 */
export async function tagContent(content, availableTags) {
  if (!availableTags || availableTags.length === 0) return [];

  const tagList = availableTags.map((t) => `- ${t.slug}: ${t.name}`).join('\n');

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [TAG_TOOL],
    tool_choice: { type: 'tool', name: 'assign_tags' },
    messages: [
      {
        role: 'user',
        content: `다음 콘텐츠가 아래 태그 목록 중 어디에 해당하는지 판단해줘.
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
