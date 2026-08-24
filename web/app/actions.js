'use server';

import { getSupabase } from '@/lib/supabase';

export async function subscribe(prevState, formData) {
  const email = (formData.get('email') || '').toString().trim();
  const name = (formData.get('name') || '').toString().trim();
  const tagIds = formData.getAll('tags');

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { status: 'error', message: '올바른 이메일 주소를 입력해주세요.' };
  }
  if (!name) {
    return { status: 'error', message: '이름을 입력해주세요.' };
  }
  if (tagIds.length === 0) {
    return { status: 'error', message: '관심 분야를 하나 이상 선택해주세요.' };
  }

  const consent = formData.get('consent');
  if (!consent) {
    return { status: 'error', message: '개인정보 수집·이용에 동의해주세요.' };
  }

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from('subscribers')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let subscriberId;

  if (existing) {
    subscriberId = existing.id;
    const { error: updateError } = await supabase
      .from('subscribers')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', subscriberId);
    if (updateError) {
      return { status: 'error', message: `저장 실패: ${updateError.message}` };
    }
    await supabase.from('subscriber_tags').delete().eq('subscriber_id', subscriberId);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('subscribers')
      .insert({ email, name })
      .select('id')
      .single();
    if (insertError) {
      return { status: 'error', message: `저장 실패: ${insertError.message}` };
    }
    subscriberId = inserted.id;
  }

  const rows = tagIds.map((tagId) => ({ subscriber_id: subscriberId, tag_id: tagId }));
  const { error: tagsError } = await supabase.from('subscriber_tags').insert(rows);
  if (tagsError) {
    return { status: 'error', message: `관심 태그 저장 실패: ${tagsError.message}` };
  }

  return {
    status: 'success',
    message: existing ? '관심 분야가 업데이트됐습니다!' : '구독 신청이 완료됐습니다!',
  };
}
