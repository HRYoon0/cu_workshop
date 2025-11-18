'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  subscribeToSurveySession,
  updateSurveySessionStatus,
  updateSurveySessionItem,
  saveCurrentResponsesAndMoveNext
} from '@/lib/firestore';
import { auth } from '@/lib/firebase';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SurveySessionPage({ params }: PageProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);

  const sessionRef = useRef<any>(null);

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToSurveySession(sessionId, (sessionData) => {
      setTimeout(() => {
        setSession(sessionData);
        sessionRef.current = sessionData;
        setLoading(false);
      }, 0);
    });

    return () => unsubscribe();
  }, [sessionId]);

  const handleStartSurvey = async () => {
    try {
      await updateSurveySessionStatus(sessionId, 'active');
    } catch (err) {
      console.error('설문 시작 실패:', err);
      alert('설문 시작에 실패했습니다.');
    }
  };

  const handleShowResult = async () => {
    try {
      await updateSurveySessionStatus(sessionId, 'showing_result');
    } catch (err) {
      console.error('결과 표시 실패:', err);
      alert('결과 표시에 실패했습니다.');
    }
  };

  const handleNextItem = async () => {
    if (!session || !session.surveyItems) return;

    const currentItem = session.surveyItems[session.currentItemIndex];
    const nextIndex = session.currentItemIndex + 1;

    try {
      // 현재 항목의 응답 저장 후 다음으로 이동
      await saveCurrentResponsesAndMoveNext(sessionId, currentItem.id, session.currentItemIndex);
    } catch (err) {
      console.error('다음 항목 이동 실패:', err);
      alert('다음 항목 이동에 실패했습니다.');
    }
  };

  const handleEndSurvey = async () => {
    try {
      await updateSurveySessionStatus(sessionId, 'finished');
      alert('설문이 종료되었습니다!');
    } catch (err) {
      console.error('설문 종료 실패:', err);
      alert('설문 종료에 실패했습니다.');
    }
  };

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

  if (error || !session || !session.surveyItems) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">오류 발생</h2>
          <p className="text-gray-600 mb-6">{error || '설문 세션을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            관리자 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const currentItem = session.surveyItems[session.currentItemIndex];
  const activeParticipants = session.participants || [];
  const participantCount = activeParticipants.length;

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
          <p className="text-xl text-gray-600 mb-8">모든 설문이 완료되었습니다.</p>
          <div className="bg-green-50 rounded-xl p-6 mb-8">
            <p className="text-lg font-semibold text-green-800">총 {session.surveyItems.length}개 설문 완료</p>
            <p className="text-gray-600 mt-2">참여자 {participantCount}명</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-lg font-semibold"
          >
            관리자 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 대기실
  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">설문 대기실</h1>
                <p className="text-gray-600">총 {session.surveyItems.length}개의 설문 항목</p>
              </div>
              <button
                onClick={() => router.push('/admin')}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
              >
                관리자 페이지
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">참여자</h2>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-green-600">{participantCount}</span>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {activeParticipants.map((p: any) => (
                  <div key={p.id} className="bg-green-50 rounded-lg px-4 py-3 flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-semibold text-gray-800">{p.nickname}</span>
                  </div>
                ))}
                {participantCount === 0 && (
                  <p className="text-gray-400 text-center py-8">참여자를 기다리는 중...</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">QR 코드</h2>
              <div className="bg-white p-4 rounded-xl border-4 border-green-200">
                <QRCodeSVG
                  value={`${window.location.origin}/participate/survey/${sessionId}`}
                  size={200}
                  level="H"
                />
              </div>
              <p className="text-gray-600 mt-4 text-center">QR 코드를 스캔하여 참여하세요</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">설문 목록 미리보기</h2>
            <div className="space-y-3">
              {session.surveyItems.map((item: any, idx: number) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{item.question}</p>
                    <p className="text-sm text-gray-500">{item.type === 'multiple' ? '선다형' : '서술형'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleStartSurvey}
              className="px-12 py-6 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors text-2xl font-bold shadow-xl"
            >
              설문 시작하기
            </button>
          </div>
        </div>

        {/* QR 모달 */}
        {showQRModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowQRModal(false)}
          >
            <div className="bg-white rounded-3xl p-12 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">참여 QR 코드</h2>
              <div className="flex justify-center mb-6">
                <div className="bg-white p-6 rounded-2xl border-4 border-green-200">
                  <QRCodeSVG
                    value={`${window.location.origin}/participate/survey/${sessionId}`}
                    size={300}
                    level="H"
                  />
                </div>
              </div>
              <p className="text-center text-gray-600 mb-6">스캔하여 참여하세요</p>
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-green-600 text-white py-4 rounded-xl hover:bg-green-700 transition-colors font-semibold text-lg"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 결과 표시 화면
  if (session.status === 'showing_result') {
    return <SurveyResultView
      session={session}
      sessionId={sessionId}
      currentItem={currentItem}
      handleNextItem={handleNextItem}
      handleEndSurvey={handleEndSurvey}
      router={router}
    />;
  }

  // 설문 진행 중
  return <SurveyActiveView
    session={session}
    sessionId={sessionId}
    currentItem={currentItem}
    participantCount={participantCount}
    handleShowResult={handleShowResult}
    handleEndSurvey={handleEndSurvey}
    router={router}
  />;
}

// 설문 진행 중 화면
function SurveyActiveView({
  session,
  sessionId,
  currentItem,
  participantCount,
  handleShowResult,
  handleEndSurvey,
  router
}: any) {
  const responses = session.responses || [];
  const responseCount = responses.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">설문 진행 중</h1>
              <p className="text-gray-600 mt-1">
                {session.currentItemIndex + 1} / {session.surveyItems.length}
                <span className="ml-4 font-semibold text-green-600">진행 중</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEndSurvey}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                설문 종료
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
              >
                관리자 페이지
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                설문 {session.currentItemIndex + 1}
              </h2>
              <div className="bg-green-100 px-4 py-2 rounded-lg">
                <span className="text-green-700 font-bold">응답: {responseCount} / {participantCount}</span>
              </div>
            </div>

            <p className="text-xl text-gray-700 mb-4 whitespace-pre-line">{currentItem.question}</p>

            {currentItem.type === 'multiple' && (
              <div className="space-y-2">
                {currentItem.options.map((option: string, idx: number) => (
                  <div key={idx} className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                    <span className="font-medium text-gray-700">{idx + 1}. {option}</span>
                  </div>
                ))}
                {currentItem.allowOther && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                    <span className="font-medium text-gray-700">기타 (직접 입력)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl p-6">
            <p className="text-center text-blue-800 font-semibold">
              참여자들이 응답하는 중입니다... ({responseCount}/{participantCount})
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleShowResult}
            disabled={responseCount === 0}
            className="px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-xl font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            결과 보기
          </button>
        </div>
      </div>
    </div>
  );
}

// 결과 표시 화면
function SurveyResultView({
  session,
  sessionId,
  currentItem,
  handleNextItem,
  handleEndSurvey,
  router
}: any) {
  const responses = session.responses || [];
  const isLastItem = session.currentItemIndex >= session.surveyItems.length - 1;

  // 선다형 통계 계산
  const optionCounts: { [key: string]: number } = {};
  const otherResponses: string[] = [];

  if (currentItem.type === 'multiple') {
    responses.forEach((r: any) => {
      if (r.answer === 'other' && r.otherText) {
        otherResponses.push(r.otherText);
      } else if (typeof r.answer === 'number') {
        const option = currentItem.options[r.answer];
        optionCounts[option] = (optionCounts[option] || 0) + 1;
      }
    });
  }

  const maxCount = Math.max(...Object.values(optionCounts), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">설문 결과</h1>
              <p className="text-gray-600 mt-1">
                {session.currentItemIndex + 1} / {session.surveyItems.length}
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
            >
              관리자 페이지
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 설문 결과 차트 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📊 응답 결과</h3>

            {currentItem.type === 'multiple' ? (
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
                      <div className="w-full bg-gray-200 rounded-full h-8">
                        <div
                          className="bg-green-600 h-8 rounded-full flex items-center justify-end pr-3 text-white font-bold text-sm"
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 10 && `${percentage.toFixed(0)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {otherResponses.length > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">기타 의견</span>
                      <span className="text-gray-600">{otherResponses.length}명</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {otherResponses.map((text, idx) => (
                        <p key={idx} className="text-sm text-gray-700 mb-1">• {text}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {responses.map((r: any, idx: number) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">{r.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 학생 결과 이미지 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-blue-700 mb-4">👦 학생</h3>
            {currentItem.studentResultImageUrl ? (
              <img
                src={currentItem.studentResultImageUrl}
                alt="학생 설문 결과"
                className="w-full h-auto rounded-lg"
              />
            ) : (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">결과 이미지 없음</p>
              </div>
            )}
          </div>

          {/* 학부모 결과 이미지 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-purple-700 mb-4">👨‍👩‍👧 학부모</h3>
            {currentItem.parentResultImageUrl ? (
              <img
                src={currentItem.parentResultImageUrl}
                alt="학부모 설문 결과"
                className="w-full h-auto rounded-lg"
              />
            ) : (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">결과 이미지 없음</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          {!isLastItem ? (
            <button
              onClick={handleNextItem}
              className="px-12 py-6 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors text-2xl font-bold shadow-xl"
            >
              다음 설문
            </button>
          ) : (
            <button
              onClick={handleEndSurvey}
              className="px-12 py-6 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors text-2xl font-bold shadow-xl"
            >
              설문 완료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
