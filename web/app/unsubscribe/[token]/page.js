import { getSupabase } from '@/lib/supabase';
import UnsubscribeButton from './UnsubscribeButton';

export default async function UnsubscribePage({ params }) {
  const { token } = await params;
  const supabase = getSupabase();

  const { data: send } = await supabase
    .from('sends')
    .select('subscribers(email, status)')
    .eq('digest_token', token)
    .maybeSingle();

  const subscriber = send?.subscribers;

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[42rem] rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-sm tracking-widest text-accent uppercase">AX Signal</span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)]">
          <div
            aria-hidden
            className="h-1 w-full"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-secondary))' }}
          />
          <div className="p-8 text-center">
            {!subscriber ? (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">잘못된 링크예요</h1>
                <p className="mt-2 text-sm text-neutral-500">이메일에 있던 링크를 다시 확인해주세요.</p>
              </>
            ) : subscriber.status === 'unsubscribed' ? (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">이미 구독 해지됐어요</h1>
                <p className="mt-2 text-sm text-neutral-500">{subscriber.email}로 더 이상 메일을 보내지 않아요.</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">구독을 해지할까요?</h1>
                <p className="mt-2 text-sm text-neutral-500">{subscriber.email}로 더 이상 AX Signal을 받지 않게 돼요.</p>
                <UnsubscribeButton token={token} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
