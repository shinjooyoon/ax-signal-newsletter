import { createClient } from '@supabase/supabase-js';

// service_role 키는 서버 컴포넌트/서버 액션에서만 import 해서 씁니다.
// 절대 클라이언트 컴포넌트로 넘기거나 NEXT_PUBLIC_ 환경변수로 노출하지 마세요.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  }
  return createClient(url, key);
}
