import { getSupabase } from '@/lib/supabase';

// 이메일 속 기사 링크의 경유지. 클릭을 기록한 뒤 원문으로 보낸다.
//   /r/[digest_token]/[content_item_id]?p=hero|sk|news|term
//
// 이동할 주소는 쿼리로 받지 않고 항상 DB(content_items.url)에서 꺼낸다 — 주소를 그대로
// 받으면 아무 사이트로나 보낼 수 있는 오픈 리다이렉트가 되기 때문.
// 기록이 실패해도 구독자는 반드시 원문으로 이동해야 하므로, 기록은 이동을 막지 않는다.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIONS = new Set(['hero', 'sk', 'news', 'term']);

function redirectTo(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' }
  });
}

export async function GET(request, { params }) {
  const { token, itemId } = await params;
  const home = new URL('/', request.url).toString();

  if (!UUID.test(itemId)) return redirectTo(home);

  const supabase = getSupabase();
  const { data: item } = await supabase.from('content_items').select('url').eq('id', itemId).maybeSingle();
  if (!item?.url || !/^https?:\/\//i.test(item.url)) return redirectTo(home);

  try {
    const { data: send } = await supabase
      .from('sends')
      .select('id, clicked_at')
      .eq('digest_token', token)
      .maybeSingle();

    if (send) {
      const position = new URL(request.url).searchParams.get('p');
      const { error } = await supabase.from('click_events').insert({
        send_id: send.id,
        content_item_id: itemId,
        link_position: POSITIONS.has(position) ? position : null
      });
      if (error) console.error(`[click] 기록 실패: ${error.message}`);

      // sends.clicked_at = 이 메일에서 처음 클릭한 시각 (회차별 클릭률 계산용)
      if (!send.clicked_at) {
        await supabase.from('sends').update({ clicked_at: new Date().toISOString() }).eq('id', send.id);
      }
    }
  } catch (err) {
    console.error(`[click] 기록 실패: ${err?.message}`);
  }

  return redirectTo(item.url);
}
