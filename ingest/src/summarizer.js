import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

const SUMMARY_TOOL = {
  name: 'summarize',
  description: '기사 제목과 원문 일부를 보고 다이제스트에 실을 짧은 요약을 만듭니다.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description:
          '2~3문장, 원문 문장을 그대로 베끼지 말고 반드시 자기 말로 재서술. 무엇을, 왜 중요한지 위주로.'
      }
    },
    required: ['summary']
  }
};

/**
 * 제목 + 원문 일부(RSS 스니펫, 수동 입력 요약 등)를 재서술한 짧은 요약을 만든다.
 * 원문이 너무 짧아 의미 있는 재서술이 어려우면 null을 반환한다 — 그럴 땐 억지로 요약을
 * 만드느니 제목만 보여주는 게 낫다. 저작권 문제를 피하려고 항상 재서술을 요구하고,
 * 원문 자체를 그대로 저장하거나 노출하지 않는다.
 * @param {{ title: string, rawText?: string }} content
 * @returns {Promise<string|null>}
 */
export async function summarizeContent({ title, rawText }) {
  const cleanedRaw = (rawText ?? '').trim();
  if (cleanedRaw.length < 20) return null;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: 'summarize' },
    messages: [
      {
        role: 'user',
        content: `아래 기사를 뉴스레터 다이제스트용으로 2~3문장 요약해줘.

중요: 원문 문장을 그대로 복사하면 안 된다. 반드시 너 자신의 말로 다시 써야 한다(재서술).
독자는 AI/AX(AI Transformation)를 공부 중인 사람들이니, 무엇이 왜 중요한지가 드러나게 써줘.

제목: ${title}
원문: ${cleanedRaw.slice(0, 2000)}`
      }
    ]
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  const summary = toolUse?.input?.summary;
  return summary ? summary.trim() : null;
}

const TERM_TOOL = {
  name: 'pick_term',
  description:
    '오늘 콘텐츠 중 학습자에게 의미 있는 AI/AX 용어 하나를 뽑아 뜻풀이를 반환합니다. 뽑을 만한 용어가 없으면 has_term을 false로 반환합니다.',
  input_schema: {
    type: 'object',
    properties: {
      has_term: { type: 'boolean', description: '설명할 만한 새 용어가 있으면 true' },
      term: { type: 'string' },
      definition: { type: 'string', description: '2~3문장, 쉬운 말로 풀어서 설명' },
      source_index: {
        type: 'number',
        description: '이 용어가 나온 항목의 번호(아래 목록 기준, 1부터 시작)'
      }
    },
    required: ['has_term']
  }
};

/**
 * 오늘 실린 콘텐츠 목록에서 학습자에게 의미 있는 AI/AX 용어 하나를 뽑아 뜻풀이를 만든다.
 * 이미 다룬 용어 목록을 프롬프트에 제외 항목으로 넘겨서 중복 설명을 줄인다. 마땅한 용어가
 * 없으면(콘텐츠가 전부 일반 산업 뉴스뿐이거나 다 이미 다룬 용어뿐이면) null을 반환한다 —
 * 그럴 땐 "오늘의 용어" 섹션 자체를 렌더링하지 않는 게 맞다.
 * @param {{title:string, summary?:string}[]} items
 * @param {string[]} usedTerms
 * @returns {Promise<{term:string, definition:string, sourceIndex:number|null}|null>}
 */
export async function pickTermOfDay(items, usedTerms = []) {
  if (!items || items.length === 0) return null;

  const list = items.map((it, i) => `${i + 1}. ${it.title}${it.summary ? ' - ' + it.summary : ''}`).join('\n');
  const usedList = usedTerms.length > 0 ? `\n\n이미 다룬 용어(가능하면 피해줘): ${usedTerms.join(', ')}` : '';

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [TERM_TOOL],
    tool_choice: { type: 'tool', name: 'pick_term' },
    messages: [
      {
        role: 'user',
        content: `아래는 오늘 뉴스레터에 실리는 콘텐츠 목록이다. 이 중 AI/AX를 공부 중인 독자에게
설명해주면 도움이 될 만한 용어를 딱 하나만 뽑아서 쉬운 말로 뜻풀이해줘.
전문 용어일 필요는 없지만 그냥 흔한 단어는 피하고, 오늘 콘텐츠와 실제로 관련 있는 것으로 골라줘.
마땅한 게 없으면 억지로 만들지 말고 has_term을 false로 반환해.${usedList}

[오늘 콘텐츠]
${list}`
      }
    ]
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  const input = toolUse?.input;
  if (!input?.has_term || !input.term || !input.definition) return null;

  return {
    term: input.term.trim(),
    definition: input.definition.trim(),
    sourceIndex: typeof input.source_index === 'number' ? input.source_index : null
  };
}
