'use client';

import { useActionState } from 'react';
import { unsubscribe } from './actions';

const initialState = { status: 'idle', message: '' };

export default function UnsubscribeButton({ token }) {
  const [state, formAction, pending] = useActionState(unsubscribe, initialState);

  if (state.status === 'success') {
    return <p className="mt-6 text-sm text-emerald-600">{state.message}</p>;
  }

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? '처리 중...' : '구독 해지하기'}
      </button>
      {state.status === 'error' && <p className="mt-3 text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
