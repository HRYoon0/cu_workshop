'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getSurveySession,
  subscribeToSurveySession,
  addParticipantToSurveySession,
  submitSurveyResponse
} from '@/lib/firestore';

export default function SurveyParticipatePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [participantId, setParticipantId] = useState('');
  const [participantNumber, setParticipantNumber] = useState(0);
  const [hasJoined, setHasJoined] = useState(false);

  // 현재 설문 답변 상태
  const [currentAnswer, setCurrentAnswer] = useState<any>(null);
  const [otherText, setOtherText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    loadSession();

    const unsubscribe = subscribeToSurveySession(sessionId, (sessionData) => {
      setSession(sessionData);
    });

    return () => unsubscribe();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const sessionData = await getSurveySession(sessionId);
      setSession(sessionData);
    } catch (error) {
      console.error('세션 정보 가져오기 실패:', error);
      alert('세션을 찾을 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      console.log('🎯 설문 참가 시작');
      console.log('세션 ID:', sessionId);
      console.log('현재 세션 데이터:', session);

      const pid = `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('생성된 참가자 ID:', pid);

      // 현재 참여자 수 + 1로 번호 부여
      const participantCount = session?.participants?.length || 0;
      const number = participantCount + 1;
      const nickname = `참여자 ${number}`;

      console.log('참가자 번호:', number);
      console.log('참가자 닉네임:', nickname);

      console.log('Firestore에 참가자 추가 중...');
      await addParticipantToSurveySession(sessionId, {
        id: pid,
        nickname
      });

      console.log('✅ 참가 성공!');
      setParticipantId(pid);
      setParticipantNumber(number);
      setHasJoined(true);
    } catch (error: any) {
      console.error('❌ 참가 실패:', error);
      console.error('에러 메시지:', error?.message);
      console.error('에러 상세:', error);
      alert(`참가에 실패했습니다.\n\n에러: ${error?.message || error}\n\n브라우저 콘솔(F12)에서 자세한 내용을 확인해주세요.`);
    }
  };

  const handleSubmit = async () => {
    if (!session || !session.surveyItems) return;

    const currentItem = session.surveyItems[session.currentItemIndex];

    // 답변 검증
    if (currentAnswer === null && currentItem.type !== 'text') {
      alert('답변을 선택해주세요.');
      return;
    }

    if (currentItem.type === 'text' && !currentAnswer?.trim()) {
      alert('답변을 입력해주세요.');
      return;
    }

    // 기타 의견 검증
    if (currentAnswer === 'other' && !otherText.trim()) {
      alert('기타 의견을 입력해주세요.');
      return;
    }

    try {
      await submitSurveyResponse(sessionId, {
        participantId,
        answer: currentAnswer,
        ...(currentAnswer === 'other' && { otherText: otherText.trim() })
      });

      setSubmitted(true);
      setCurrentAnswer(null);
      setOtherText('');
    } catch (error) {
      console.error('응답 제출 실패:', error);
      alert('응답 제출에 실패했습니다.');
    }
  };

  // 새 설문 항목으로 이동 시 초기화
  useEffect(() => {
    if (session?.status === 'active') {
      setSubmitted(false);
      setCurrentAnswer(null);
      setOtherText('');
    }
  }, [session?.currentItemIndex, session?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">오류 발생</h2>
          <p className="text-gray-600">세션을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  // 참가하지 않은 경우 - 참여 버튼만 표시
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">설문 참여</h1>
            <p className="text-gray-600">아래 버튼을 클릭하여 설문에 참여하세요</p>
            <p className="text-sm text-gray-500 mt-2">설문은 익명으로 진행됩니다</p>
          </div>

          <button
            onClick={handleJoin}
            className="w-full px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            참여하기
          </button>
        </div>
      </div>
    );
  }

  const currentItem = session.surveyItems?.[session.currentItemIndex];

  // 완료 화면
  if (session.status === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-12 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">수고하셨습니다!</h1>
          <p className="text-xl text-gray-600 mb-8">설문이 완료되었습니다.</p>
          <p className="text-gray-500">참여해주셔서 감사합니다.</p>
        </div>
      </div>
    );
  }

  // 대기실
  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-12 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">대기 중</h1>
          <p className="text-xl text-gray-600 mb-8">설문이 곧 시작됩니다...</p>
          <p className="text-gray-500">진행자가 설문을 시작할 때까지 기다려주세요.</p>
        </div>
      </div>
    );
  }

  // 결과 표시 화면
  if (session.status === 'showing_result') {
    const responses = session.responses || [];
    const optionCounts: { [key: string]: number } = {};
    const otherResponses: string[] = [];

    if (currentItem?.type === 'multiple') {
      responses.forEach((r: any) => {
        if (r.answer === 'other' && r.otherText) {
          otherResponses.push(r.otherText);
        } else if (typeof r.answer === 'number') {
          const option = currentItem.options[r.answer];
          optionCounts[option] = (optionCounts[option] || 0) + 1;
        }
      });
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">설문 결과</h1>
            <p className="text-gray-600 text-center">
              {session.currentItemIndex + 1} / {session.surveyItems.length}
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{currentItem?.question}</h2>

            {currentItem?.type === 'multiple' ? (
              <div className="space-y-3">
                {currentItem.options.map((option: string, idx: number) => {
                  const count = optionCounts[option] || 0;
                  const percentage = responses.length > 0 ? (count / responses.length) * 100 : 0;

                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{option}</span>
                        <span className="text-gray-600">{count}명 ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-green-600 h-6 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-600">
                <p>서술형 응답은 관리자 화면에서 확인할 수 있습니다.</p>
              </div>
            )}
          </div>

          {/* 이미지 표시 */}
          {(currentItem?.studentResultImageUrl || currentItem?.parentResultImageUrl) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentItem.studentResultImageUrl && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                  <h3 className="text-lg font-bold text-blue-700 mb-2">👦 학생</h3>
                  <img
                    src={currentItem.studentResultImageUrl}
                    alt="학생 결과"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              )}

              {currentItem.parentResultImageUrl && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                  <h3 className="text-lg font-bold text-purple-700 mb-2">👨‍👩‍👧 학부모</h3>
                  <img
                    src={currentItem.parentResultImageUrl}
                    alt="학부모 결과"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-6 bg-blue-50 rounded-2xl p-6 text-center">
            <p className="text-blue-800 font-semibold">
              다음 설문을 기다리는 중...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 설문 진행 중 - 답변 화면
  if (session.status === 'active' && currentItem) {
    if (submitted) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-12 text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">제출 완료!</h1>
            <p className="text-xl text-gray-600">응답이 제출되었습니다.</p>
            <p className="text-gray-500 mt-4">결과를 기다리는 중...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
            <div className="text-center mb-2">
              <span className="inline-block bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-lg">
                {session.currentItemIndex + 1} / {session.surveyItems.length}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 text-center mb-4">{currentItem.question}</h1>

            {currentItem.type === 'multiple' ? (
              <div className="space-y-3">
                {currentItem.options.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentAnswer(idx)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left font-medium ${
                      currentAnswer === idx
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300 text-gray-700'
                    }`}
                  >
                    {idx + 1}. {option}
                  </button>
                ))}

                {currentItem.allowOther && (
                  <div>
                    <button
                      onClick={() => setCurrentAnswer('other')}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left font-medium ${
                        currentAnswer === 'other'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300 text-gray-700'
                      }`}
                    >
                      기타 (직접 입력)
                    </button>

                    {currentAnswer === 'other' && (
                      <input
                        type="text"
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="의견을 입력하세요"
                        className="w-full mt-2 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-gray-900"
                        maxLength={200}
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={currentAnswer || ''}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="답변을 입력하세요"
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-gray-900"
                maxLength={500}
              />
            )}

            <button
              onClick={handleSubmit}
              disabled={currentAnswer === null && currentItem.type !== 'text'}
              className="w-full mt-6 px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-xl font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              제출하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
