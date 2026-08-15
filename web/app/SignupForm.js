'use client';

import { useActionState } from 'react';
import { subscribe } from './actions';

const initialState = { status: 'idle', message: '' };

export default function SignupForm({ tags }) {
  const [state, formAction, pending] = useActionState(subscribe, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          이메일 *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@company.com"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          이름 (선택)
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="홍길동"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium mb-2">관심 분야 (복수 선택 가능) *</legend>
        <div className="grid grid-cols-2 gap-2">
          {tags.map((tag) => (
            <label
              key={tag.id}
              className="flex items-center gap-2 text-sm rounded-lg border border-neutral-200 px-3 py-2 cursor-pointer hover:bg-neutral-50"
            >
              <input type="checkbox" name="tags" value={tag.id} className="accent-neutral-800" />
              {tag.name}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-neutral-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition"
      >
        {pending ? '처리 중...' : '구독하기'}
      </button>

      {state.status !== 'idle' && (
        <p
          className={`text-sm text-center ${
            state.status === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
