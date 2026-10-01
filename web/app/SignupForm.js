'use client';

import { useActionState, useState } from 'react';
import { subscribe } from './actions';

const initialState = { status: 'idle', message: '' };

// 계열사 소식이 아직 적은 분야는 미리 알려준다 (콘텐츠 쌓이면 여기서 지우면 됨)
const LOW_CONTENT_TAGS = new Set(['바이오']);

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-soft';

export default function SignupForm({ tags, defaultEmail = '' }) {
  const [state, formAction, pending] = useActionState(subscribe, initialState);
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
          이메일 <span className="text-accent">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus={!defaultEmail}
          defaultValue={defaultEmail}
          placeholder="you@company.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-neutral-700">
          이름 <span className="text-accent">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="홍길동"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-neutral-400">메일 인사말에 이름으로 사용돼요</p>
      </div>

      <fieldset>
        <div className="mb-2.5 flex items-baseline justify-between">
          <legend className="text-sm font-medium text-neutral-700">
            관심 분야 (복수 선택 가능) <span className="text-accent">*</span>
          </legend>
          <span
            className={`text-xs transition-colors ${
              selectedCount > 0 ? 'text-accent' : 'text-neutral-400'
            }`}
          >
            {selectedCount > 0 ? `${selectedCount}개 선택됨` : '최소 1개 선택'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <label key={tag.id} className="group relative">
              <input
                type="checkbox"
                name="tags"
                value={tag.id}
                className="peer sr-only"
                onChange={(e) => setSelectedCount((c) => c + (e.target.checked ? 1 : -1))}
              />
              <span className="block cursor-pointer select-none rounded-full border border-neutral-200 px-3.5 py-1.5 text-sm text-neutral-600 transition peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-checked:shadow-sm peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft hover:border-neutral-300 hover:bg-neutral-50 peer-checked:hover:bg-accent-hover">
                {tag.name}
                {LOW_CONTENT_TAGS.has(tag.name) && (
                  <span className="ml-1 text-xs text-neutral-400 peer-checked:text-white/70">
                    (소식 적음)
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 px-3.5 py-3">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-accent focus:ring-accent-soft"
        />
        <label htmlFor="consent" className="text-xs leading-relaxed text-neutral-500">
          수집하는 개인정보(이메일, 이름)는 AX Signal 뉴스레터 발송 목적으로만 사용되며, 구독 해지 시 즉시 파기됩니다. 뉴스레터 개선을 위해 메일 속 기사 링크의 클릭 여부를 기록하며, 기기·위치 정보는 수집하지 않습니다. 동의하지 않으실 경우 구독 신청이 제한될 수 있습니다.{' '}
          <span className="text-accent">(필수)</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent-hover hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
      >
        {pending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
            />
          </svg>
        )}
        {pending ? '처리 중...' : '구독하기'}
      </button>

      {state.status !== 'idle' && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            state.status === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-red-100 bg-red-50 text-red-700'
          }`}
        >
          {state.status === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="shrink-0">
              <path
                d="M16.667 5L7.5 14.167 3.333 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="shrink-0">
              <path
                d="M10 6.667v4.166M10 13.75h.008M10 2.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{state.message}</span>
        </div>
      )}
    </form>
  );
}
