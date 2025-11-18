'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getOpinionSession, submitOpinion, subscribeToOpinionSession } from '@/lib/firestore';

export default function ParticipatePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 자유 의견 입력값
  const [freeOpinion, setFreeOpinion] = useState('');

  // 찬반형 선택값
  const [scaleValue, setScaleValue] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // 세션 정보 가져오기
    loadSession();

    // 실시간 구독
    const unsubscribe = subscribeToOpinionSession(sessionId, (sessionData) => {
      setSession(sessionData);

      // 세션이 종료되면 알림
      if (sessionData.status === 'closed') {
        alert('의견 수집이 종료되었습니다.');
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const sessionData = await getOpinionSession(sessionId);
      setSession(sessionData);
    } catch (error) {
      console.error('세션 정보 가져오기 실패:', error);
      alert('세션을 찾을 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFreeOpinion = async () => {
    if (!freeOpinion.trim()) {
      alert('의견을 입력해주세요.');
      return;
    }

    if (!confirm('의견을 제출하시겠습니까?')) {
      return;
    }

    try {
      setSubmitting(true);
      await submitOpinion(sessionId, {
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
    if (scaleValue === null) {
      alert('선택해주세요.');
      return;
    }

    if (!confirm('제출하시겠습니까?')) {
      return;
    }

    try {
      setSubmitting(true);
      await submitOpinion(sessionId, {
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <p className="text-red-600 text-lg mb-4">세션을 찾을 수 없습니다.</p>
          <p className="text-gray-600">올바른 링크인지 확인해주세요.</p>
        </div>
      </div>
    );
  }

  if (session.status === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <p className="text-orange-600 text-lg mb-4">의견 수집이 종료되었습니다.</p>
          <p className="text-gray-600">이미 마감된 세션입니다.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-600 text-xl font-bold mb-2">제출 완료!</p>
          <p className="text-gray-600">소중한 의견 감사합니다.</p>
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
            <p className="text-blue-800 font-semibold">{session.discussionTopic}</p>
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
