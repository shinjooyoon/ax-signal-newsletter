import { getSupabase } from '@/lib/supabase';
import SignupForm from './SignupForm';

export default async function Home() {
  const supabase = getSupabase();
  const { data: tags, error } = await supabase
    .from('tags')
    .select('id, slug, name')
    .not('parent_id', 'is', null)
    .order('name');

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-red-600">태그를 불러오지 못했습니다: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-neutral-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
        <h1 className="text-2xl font-bold mb-1">AX Signal 구독하기</h1>
        <p className="text-neutral-500 mb-6 text-sm">
          관심 있는 산업 분야를 선택하면, 관련 AI/AX 소식만 골라서 보내드립니다.
        </p>
        <SignupForm tags={tags} />
      </div>
    </main>
  );
}
