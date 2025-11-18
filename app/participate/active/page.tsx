'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getActiveOpinionSessionByUserId, submitOpinion, subscribeToActiveOpinionSessionByUserId, subscribeToOpinions } from '@/lib/firestore';

function ActiveParticipateContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('uid') || process.env.NEXT_PUBLIC_ADMIN_UID || '';

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 자유 의견 입력값
  const [freeOpinion, setFreeOpinion] = useState('');

  // 찬반형 선택값
  const [scaleValue, setScaleValue] = useState<number | null>(null);

  // 이전 세션 ID를 추적하기 위한 ref
  const previousSessionIdRef = useRef<string | null>(null);
  // 세션이 null이 되기 직전의 세션 ID를 저장 (재시작 감지용)
  const lastKnownSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log('🔄 실시간 활성 세션 구독 시작');

    // 실시간 활성 세션 구독
    const unsubscribe = subscribeToActiveOpinionSessionByUserId(userId, (sessionData) => {
      console.log('📨 새 세션 데이터 수신:', sessionData);

      if (sessionData) {
        const newSessionId = sessionData.id;
        const previousSessionId = previousSessionIdRef.current;

        console.log('이전 세션 ID:', previousSessionId);
        console.log('새 세션 ID:', newSessionId);
        console.log('마지막 알려진 세션 ID:', lastKnownSessionIdRef.current);

        // 세션이 변경되었는지 확인
        // 1. 이전 세션이 있고 ID가 다른 경우
        // 2. 이전 세션은 null이지만 마지막 알려진 세션과 다른 경우 (재시작)
        if ((previousSessionId && newSessionId !== previousSessionId) ||
            (!previousSessionId && lastKnownSessionIdRef.current && newSessionId !== lastKnownSessionIdRef.current)) {
          console.log('✅ 세션 변경 감지! 제출 상태 초기화');
          setSubmitted(false);
          setFreeOpinion('');
          setScaleValue(null);
        }

        // 현재 세션 ID를 이전 세션 ID로 저장
        previousSessionIdRef.current = newSessionId;
        lastKnownSessionIdRef.current = newSessionId;
      } else {
        console.log('❌ 세션 없음');
        // 세션이 null이 되어도 lastKnownSessionIdRef는 유지 (재시작 감지를 위해)
        previousSessionIdRef.current = null;
      }

      setSession(sessionData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleSubmitFreeOpinion = async () => {
    if (!freeOpinion.trim() || !session) {
      alert('의견을 입력해주세요.');
      return;
    }

    if (!confirm('의견을 제출하시겠습니까?')) {
      return;
    }

    try {
      setSubmitting(true);
      await submitOpinion(session.id, {
        type: 'free',
        content: freeOpinion.trim(),
      });
      setSubmitted(true);
      alert('의견이 제출되었습니다!');
    } catch (error) {
      console.error('의견 제출 실패:', error);
      alert('의견 제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitScale = async () => {
    if (scaleValue === null || !session) {
      alert('선택해주세요.');
      return;
    }

    if (!confirm('제출하시겠습니까?')) {
      return;
    }

    try {
      setSubmitting(true);
      await submitOpinion(session.id, {
        type: 'scale',
        value: scaleValue,
      });
      setSubmitted(true);
      alert('제출되었습니다!');
    } catch (error) {
      console.error('의견 제출 실패:', error);
      alert('제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-12 rounded-2xl shadow-xl max-w-2xl w-full text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-700 text-3xl font-bold mb-4">진행 중인 의견 수집이 없습니다</p>
          <p className="text-gray-600 text-xl">관리자가 의견 수집을 시작할 때까지 기다려주세요.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-12 rounded-2xl shadow-xl max-w-2xl w-full text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-600 text-3xl font-bold mb-4">제출 완료!</p>
          <p className="text-gray-700 text-xl mb-6">소중한 의견 감사합니다.</p>
          <p className="text-gray-600 text-lg">다음 논의 사항이 시작되면 다시 참여할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">의견 제출</h1>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-sm text-blue-700 mb-1">논의할 점</p>
            <p className="text-blue-900 font-bold text-lg">{session.discussionTopic}</p>
          </div>

          {session.type === 'free' ? (
            // 자유 의견 제출
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                자유롭게 의견을 작성해주세요
              </label>
              <textarea
                value={freeOpinion}
                onChange={(e) => setFreeOpinion(e.target.value)}
                placeholder="의견을 입력하세요..."
                rows={8}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                disabled={submitting}
              />
              <button
                onClick={handleSubmitFreeOpinion}
                disabled={submitting}
                className="w-full mt-4 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          ) : (
            // 찬반형 선택
            <div>
              <label className="block text-gray-700 font-semibold mb-4">
                입장을 선택해주세요
              </label>
              <div className="space-y-3">
                {[
                  { value: 2, label: '적극 찬성', color: 'bg-green-600 hover:bg-green-700' },
                  { value: 1, label: '찬성', color: 'bg-green-400 hover:bg-green-500' },
                  { value: 0, label: '보통', color: 'bg-gray-400 hover:bg-gray-500' },
                  { value: -1, label: '반대', color: 'bg-red-400 hover:bg-red-500' },
                  { value: -2, label: '적극 반대', color: 'bg-red-600 hover:bg-red-700' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setScaleValue(option.value)}
                    className={`w-full py-4 px-6 rounded-lg text-white font-bold text-lg transition-all ${
                      scaleValue === option.value
                        ? 'ring-4 ring-blue-500 ' + option.color
                        : option.color
                    }`}
                    disabled={submitting}
                  >
                    {option.label} ({option.value > 0 ? '+' : ''}{option.value})
                  </button>
                ))}
              </div>
              <button
                onClick={handleSubmitScale}
                disabled={submitting || scaleValue === null}
                className="w-full mt-6 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActiveParticipatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <ActiveParticipateContent />
    </Suspense>
  );
}
