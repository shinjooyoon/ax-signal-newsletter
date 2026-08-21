'use server';

import { getSupabase } from '@/lib/supabase';

// 이메일 발송마다 sends.digest_token이 새로 생기지만, 어느 토큰으로 와도 해당 send의
// subscriber_id만 찾으면 되므로 토큰 하나로도 충분히 본인 확인이 된다 (별도 로그인 불필요).
export async function unsubscribe(prevState, formData) {
  const token = (formData.get('token') || '').toString();
  if (!token) {
    return { status: 'error', message: '잘못된 요청이에요.' };
  }

  const supabase = getSupabase();

  const { data: send, error: sendError } = await supabase
    .from('sends')
    .select('subscriber_id')
    .eq('digest_token', token)
    .maybeSingle();

  if (sendError || !send) {
    return { status: 'error', message: '잘못된 링크예요. 이메일에 있던 링크를 다시 확인해주세요.' };
  }

  const { error: updateError } = await supabase
    .from('subscribers')
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
    .eq('id', send.subscriber_id);

  if (updateError) {
    return { status: 'error', message: `처리 실패: ${updateError.message}` };
  }

  return { status: 'success', message: '구독이 해지됐어요. 그동안 봐주셔서 감사했어요.' };
}
