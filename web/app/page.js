import { Share_Tech } from 'next/font/google';
import { getSupabase } from '@/lib/supabase';
import SignupForm from './SignupForm';

// 로고(워드마크)에만 쓰는 폰트 — 본문은 계속 Geist를 씀
const shareTech = Share_Tech({ weight: '400', subsets: ['latin'] });

export default async function Home({ searchParams }) {
  const { token } = await searchParams;
  const supabase = getSupabase();

  // 이메일 링크에는 구독자 이메일을 직접 노출하지 않고(피싱 URL로 오인돼 Gmail 콘텐츠
  // 보안 필터에 걸린 전례가 있음), sends.digest_token으로 서버에서만 이메일을 조회한다.
  let defaultEmail = '';
  if (typeof token === 'string') {
    const { data: send } = await supabase
      .from('sends')
      .select('subscribers(email)')
      .eq('digest_token', token)
      .maybeSingle();
    defaultEmail = send?.subscribers?.email ?? '';
  }

  const { data: tags, error } = await supabase
    .from('tags')
    .select('id, slug, name')
    .not('parent_id', 'is', null)
    .order('name');

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <p className="text-red-600 text-sm">태그를 불러오지 못했습니다: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-background">
      {/* subtle decorative glow, modern-SaaS style */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[42rem] rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span
            className={`${shareTech.className} text-sm tracking-widest text-accent uppercase`}
          >
            AX Signal
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)]">
          {/* SK 레드→오렌지 wings 컬러를 얇은 톱바로만 살짝 반영 */}
          <div
            aria-hidden
            className="h-1 w-full"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-secondary))' }}
          />
          <div className="p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              AX Signal 구독하기
            </h1>
            <p className="mt-2 mb-7 text-sm leading-relaxed text-neutral-500">
              관심 있는 산업 분야를 선택하면, 관련 AI/AX 소식만 골라서 보내드려요.
            </p>
            <SignupForm tags={tags} defaultEmail={defaultEmail} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          언제든 구독을 해지할 수 있어요
        </p>
      </div>
    </main>
  );
}
