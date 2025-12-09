'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { subscribeToQuizSession, getQuiz, updateQuizSessionStatus, updateQuizSessionQuestion, removeParticipantFromQuizSession } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import type { Quiz, QuizSession } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuizSessionPage({ params }: PageProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');
  const [session, setSession] = useState<QuizSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // 최신 session 참조를 위한 ref
  const sessionRef = useRef<QuizSession | null>(null);

  // params를 unwrap
  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  // 인증 확인
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 세션 데이터 구독
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToQuizSession(sessionId, (sessionData) => {
      // state 업데이트를 다음 tick으로 미루어 React error #310 방지
      setTimeout(() => {
        setSession(sessionData);
        sessionRef.current = sessionData; // ref 업데이트
      }, 0);
    });

    return () => unsubscribe();
  }, [sessionId]);

  // 퀴즈 데이터 로드
  useEffect(() => {
    if (!session || quiz || !session.quizId) return;

    let cancelled = false;

    const loadQuiz = async () => {
      try {
        const quizData = await getQuiz(session.quizId);
        if (!cancelled) {
          setQuiz(quizData);
          setLoading(false);
        }
      } catch (err) {
        console.error('퀴즈 가져오기 실패:', err);
        if (!cancelled) {
          setError('퀴즈 정보를 불러올 수 없습니다.');
          setLoading(false);
        }
      }
    };

    loadQuiz();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.quizId]);

  const handleStartQuiz = async () => {
    try {
      await updateQuizSessionStatus(sessionId, 'active');
    } catch (err) {
      console.error('퀴즈 시작 실패:', err);
      alert('퀴즈 시작에 실패했습니다.');
    }
  };

  const handleEndQuiz = async () => {
    try {
      await updateQuizSessionStatus(sessionId, 'finished');
      alert('퀴즈가 종료되었습니다. 리더보드를 확인하세요!');
    } catch (err) {
      console.error('퀴즈 종료 실패:', err);
      alert('퀴즈 종료에 실패했습니다.');
    }
  };

  const handleNextQuestion = async () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      // 세션에도 현재 문제 인덱스 업데이트 (참가자들이 구독 중)
      await updateQuizSessionQuestion(sessionId, newIndex);
    }
  };

  const handlePreviousQuestion = async () => {
    if (currentQuestionIndex > 0) {
      const newIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(newIndex);
      // 세션에도 현재 문제 인덱스 업데이트 (참가자들이 구독 중)
      await updateQuizSessionQuestion(sessionId, newIndex);
    }
  };

  // 문제가 바뀔 때마다 타이머 리셋
  useEffect(() => {
    if (quiz && quiz.questions[currentQuestionIndex]) {
      setQuestionTimer(quiz.questions[currentQuestionIndex].timeLimit);
      setShowAnswer(false);
    }
  }, [currentQuestionIndex, quiz]);

  // 타이머 카운트다운 (세션이 active 상태일 때만)
  useEffect(() => {
    // 세션이 active 상태가 아니면 타이머 동작 안 함
    if (!session || session.status !== 'active') {
      return;
    }

    if (questionTimer <= 0) {
      setShowAnswer(true);
      return;
    }

    const timer = setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev <= 1) {
          setShowAnswer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [questionTimer, session?.status]);

  // 주기적으로 비활성 참가자 DB에서 제거 (15초 이상 비활동)
  useEffect(() => {
    if (!sessionId) return;

    const cleanupInterval = setInterval(async () => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;

      const allParticipants = currentSession.participants || [];
      const now = new Date();

      for (const p of allParticipants) {
        if (!p.lastActiveAt) continue;

        try {
          const lastActive = p.lastActiveAt as any;
          const date = lastActive?.toDate ? lastActive.toDate() : new Date(lastActive);
          const diffSeconds = (now.getTime() - date.getTime()) / 1000;

          // 15초 이상 비활동 시 DB에서 제거
          if (diffSeconds > 15) {
            await removeParticipantFromQuizSession(sessionId, p.id);
          }
        } catch (e) {
          console.error('Cleanup 에러:', e);
        }
      }
    }, 5000); // 5초마다 cleanup 실행

    // Cleanup (async 작업 없음)
    return () => clearInterval(cleanupInterval);
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">세션 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => router.push('/admin')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            관리자 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!session || !quiz) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <div className="text-gray-600 mb-4">세션을 찾을 수 없습니다.</div>
          <button
            onClick={() => router.push('/admin')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            관리자 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  // 활성 참가자 필터링 (60초 이내 heartbeat 전송한 참가자만 표시)
  const activeParticipants = (session.participants || []).filter(p => {
    // joinedAt만 있고 lastActiveAt이 없는 경우 (첫 heartbeat 전) - 표시
    if (!p.lastActiveAt && p.joinedAt) return true;

    // lastActiveAt도 없고 joinedAt도 없는 경우 - 표시 (안전장치)
    if (!p.lastActiveAt) return true;

    try {
      const lastActive = p.lastActiveAt as any;
      const date = lastActive?.toDate ? lastActive.toDate() : new Date(lastActive);
      const now = new Date();
      const diffSeconds = (now.getTime() - date.getTime()) / 1000;
      console.log('참가자:', p.nickname, 'lastActive:', date, '경과시간:', diffSeconds, '초'); // 디버깅
      return diffSeconds < 60; // 60초 이내 활동한 참가자만 표시 (30초 → 60초로 완화)
    } catch (e) {
      console.error('참가자 필터링 에러:', p.nickname, e);
      return true; // 에러 시 표시
    }
  });

  const participantCount = activeParticipants.length;
  const currentAnswers = session.answers?.filter(a => a.questionIndex === currentQuestionIndex) || [];

  // 퀴즈 종료 시 리더보드 표시
  if (session.status === 'finished') {
    return <LeaderboardView session={session} quiz={quiz} router={router} sessionId={sessionId} />;
  }

  // 대기실 화면
  if (session.status === 'waiting') {
    return <WaitingRoomView
      quiz={quiz}
      sessionId={sessionId}
      session={session}
      participantCount={participantCount}
      activeParticipants={activeParticipants}
      handleStartQuiz={handleStartQuiz}
      setShowQRModal={setShowQRModal}
      showQRModal={showQRModal}
      router={router}
    />;
  }

  // 퀴즈 진행 중 - 정답 확인 및 점수 순위 화면
  if (session.status === 'active' && showAnswer) {
    return <ScoreRankingView
      quiz={quiz}
      sessionId={sessionId}
      session={session}
      currentQuestionIndex={currentQuestionIndex}
      currentQuestion={currentQuestion}
      handleNextQuestion={handleNextQuestion}
      handleEndQuiz={handleEndQuiz}
      router={router}
    />;
  }

  // 퀴즈 진행 중 - 문제 풀이 화면
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{quiz.title}</h1>
              <p className="text-gray-600 mt-1">
                문제 {currentQuestionIndex + 1} / {quiz.questions.length} | 상태: <span className="font-semibold text-green-600">진행 중</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEndQuiz}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-semibold"
              >
                퀴즈 종료
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 font-semibold"
              >
                관리자 페이지
              </button>
            </div>
          </div>
        </div>

        {/* 현재 문제 */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              문제 {currentQuestionIndex + 1}
            </h2>

            {/* 문제 내용 */}
            <div className="mb-6">
              {/* 타이머 */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 whitespace-pre-line">{currentQuestion.question}</h3>
                <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                  session?.status !== 'active' ? 'bg-yellow-100 text-yellow-700' :
                  questionTimer > 5 ? 'bg-green-100 text-green-700' :
                  questionTimer > 0 ? 'bg-red-100 text-red-700 animate-pulse' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {session?.status !== 'active' ? '대기 중' :
                   questionTimer > 0 ? `${questionTimer}초` : '종료'}
                </div>
              </div>

              {currentQuestion.imageUrl && (
                <img
                  src={currentQuestion.imageUrl}
                  alt="문제 이미지"
                  className="w-full max-h-64 object-contain rounded-lg border border-gray-300 mb-4"
                />
              )}

              {/* 선택지 */}
              <div className="space-y-2">
                {currentQuestion.options.map((option, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-2 ${
                      showAnswer && idx === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{idx + 1}.</span>
                      <span className="text-gray-900">{option}</span>
                      {showAnswer && idx === currentQuestion.correctAnswer && (
                        <span className="ml-auto text-green-600 font-semibold">✓ 정답</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!showAnswer && (
                <div className="mt-4 text-sm text-gray-500 italic text-center">
                  ⏱ 제한 시간이 끝나면 정답이 표시됩니다
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 응답 현황 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              응답 현황
            </h2>
            <div className="text-sm text-gray-600">
              {currentAnswers.length} / {participantCount}명 응답 완료
            </div>
          </div>
          <div className="bg-gray-100 rounded-lg h-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-lg transition-all duration-500"
              style={{ width: `${participantCount > 0 ? (currentAnswers.length / participantCount) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 대기실 화면
function WaitingRoomView({
  quiz,
  sessionId,
  session,
  participantCount,
  activeParticipants,
  handleStartQuiz,
  setShowQRModal,
  showQRModal,
  router,
}: {
  quiz: Quiz;
  sessionId: string;
  session: QuizSession;
  participantCount: number;
  activeParticipants: any[];
  handleStartQuiz: () => void;
  setShowQRModal: (show: boolean) => void;
  showQRModal: boolean;
  router: any;
}) {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{quiz.title}</h1>
              <p className="text-gray-600 mt-1">
                세션 ID: {sessionId.substring(0, 8)}... | 상태: <span className="font-semibold text-yellow-600">대기 중</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleStartQuiz}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 font-semibold text-lg"
              >
                퀴즈 시작
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-semibold"
              >
                관리자 페이지
              </button>
            </div>
          </div>

          {/* 참가자 정보 */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-blue-50 p-6 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-2">총 참가자</p>
              <p className="text-4xl font-bold text-blue-600">{participantCount}명</p>
            </div>
            <div className="bg-yellow-50 p-6 rounded-lg flex flex-col items-center justify-center">
              <p className="text-sm text-gray-600 mb-3">참가 QR 코드</p>
              <div
                onClick={() => setShowQRModal(true)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                title="클릭하여 확대"
              >
                <QRCodeSVG
                  value={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${typeof window !== 'undefined' ? window.location.port : '3000'}/participant?quiz=${quiz.id}&session=${sessionId}`}
                  size={120}
                  level="H"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">클릭하여 확대</p>
            </div>
          </div>
        </div>

        {/* 참가자 목록 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            참가자 목록 ({participantCount}명)
          </h2>
          {participantCount === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">아직 참가자가 없습니다.</p>
              <p className="text-gray-400 text-sm mt-2">QR 코드를 스캔하여 참여할 수 있습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {activeParticipants.map((participant, idx) => (
                <div key={idx} className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg text-center">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white font-bold text-xl">{participant.nickname.charAt(0)}</span>
                  </div>
                  <p className="font-semibold text-gray-800">{participant.nickname}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QR 코드 확대 모달 */}
        {showQRModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowQRModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{quiz.title}</h3>
                <p className="text-gray-600 mb-6">참여자용 QR 코드</p>

                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <div className="inline-block p-4 bg-white rounded-lg shadow-md">
                    <QRCodeSVG
                      value={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${typeof window !== 'undefined' ? window.location.port : '3000'}/participant?quiz=${quiz.id}&session=${sessionId}`}
                      size={280}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-4">스마트폰으로 스캔하여 참여하세요</p>
                </div>

                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 점수 순위 화면 (문제 사이)
function ScoreRankingView({
  quiz,
  sessionId,
  session,
  currentQuestionIndex,
  currentQuestion,
  handleNextQuestion,
  handleEndQuiz,
  router,
}: {
  quiz: Quiz;
  sessionId: string;
  session: QuizSession;
  currentQuestionIndex: number;
  currentQuestion: any;
  handleNextQuestion: () => void;
  handleEndQuiz: () => void;
  router: any;
}) {
  // 점수 순위 계산
  const rankedParticipants = [...(session.participants || [])]
    .filter(p => (p.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10); // 상위 10명

  const isLastQuestion = currentQuestionIndex >= quiz.questions.length - 1;

  // 이전 순위 저장 및 비교
  const [previousRanks, setPreviousRanks] = useState<{ [key: string]: number }>({});
  const [showRankChanges, setShowRankChanges] = useState(false);

  useEffect(() => {
    // 현재 순위 맵 생성
    const currentRanks: { [key: string]: number } = {};
    rankedParticipants.forEach((p, index) => {
      currentRanks[p.id] = index + 1;
    });

    // 순위 변동 애니메이션 표시
    setShowRankChanges(true);
    setTimeout(() => {
      setShowRankChanges(false);
    }, 3000);

    // 다음을 위해 현재 순위 저장
    return () => {
      setPreviousRanks(currentRanks);
    };
  }, [currentQuestionIndex]);

  // 순위 변동 계산
  const getRankChange = (participantId: string, currentRank: number) => {
    const previousRank = previousRanks[participantId];
    if (!previousRank) return null; // 첫 문제 또는 새로 진입

    const change = previousRank - currentRank;
    if (change > 0) return { type: 'up', value: change }; // 순위 상승
    if (change < 0) return { type: 'down', value: Math.abs(change) }; // 순위 하락
    return { type: 'same', value: 0 }; // 유지
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{quiz.title}</h1>
              <p className="text-gray-600 mt-1">
                문제 {currentQuestionIndex + 1} / {quiz.questions.length} 완료
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 font-semibold"
            >
              관리자 페이지
            </button>
          </div>
        </div>

        {/* 정답 표시 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📝 정답 확인</h2>
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <p className="text-gray-700 font-semibold mb-2 whitespace-pre-line">{currentQuestion.question}</p>
            <p className="text-2xl font-bold text-green-600">
              ✓ {currentQuestion.correctAnswer + 1}번: {currentQuestion.options[currentQuestion.correctAnswer]}
            </p>
          </div>
        </div>

        {/* 현재 점수 순위 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🏆 현재 순위 TOP 10</h2>
          {rankedParticipants.length === 0 ? (
            <p className="text-gray-500 text-center py-8">아직 점수가 기록된 참가자가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {rankedParticipants.map((participant, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                const rankChange = getRankChange(participant.id, rank);

                return (
                  <div
                    key={participant.id}
                    className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ${
                      rank <= 3
                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200'
                        : 'bg-gray-50'
                    } ${
                      showRankChanges && rankChange?.type === 'up'
                        ? 'shadow-lg scale-105 border-2 border-green-400 bg-green-50'
                        : showRankChanges && rankChange?.type === 'down'
                        ? 'opacity-70 scale-95'
                        : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-12 text-center">
                      {medal ? (
                        <span className="text-3xl">{medal}</span>
                      ) : (
                        <span className="text-2xl font-bold text-gray-600">{rank}</span>
                      )}
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-lg text-gray-800">{participant.nickname}</p>
                      {/* 순위 변동 표시 */}
                      {showRankChanges && rankChange && rankChange.type !== 'same' && (
                        <div className={`flex items-center gap-1 text-sm font-semibold mt-1 ${
                          rankChange.type === 'up' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {rankChange.type === 'up' ? (
                            <>
                              <span className="text-lg">↑</span>
                              <span>{rankChange.value}단계 상승!</span>
                            </>
                          ) : (
                            <>
                              <span className="text-lg">↓</span>
                              <span>{rankChange.value}단계 하락</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-2xl font-bold text-purple-600">{participant.score?.toLocaleString() ?? 0}</p>
                      <p className="text-sm text-gray-500">점</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 다음 버튼 */}
        <div className="flex gap-4">
          {!isLastQuestion ? (
            <button
              onClick={handleNextQuestion}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 font-bold text-xl shadow-lg"
            >
              다음 문제로 →
            </button>
          ) : (
            <button
              onClick={handleEndQuiz}
              className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 text-white px-8 py-4 rounded-lg hover:from-red-700 hover:to-pink-700 font-bold text-xl shadow-lg"
            >
              퀴즈 종료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 리더보드 화면
function LeaderboardView({
  session,
  quiz,
  router,
  sessionId
}: {
  session: QuizSession;
  quiz: Quiz;
  router: any;
  sessionId: string;
}) {
  // 점수 기준으로 내림차순 정렬, 상위 10명만
  const topParticipants = [...session.participants]
    .filter(p => (p.score ?? 0) > 0) // 점수가 0보다 큰 참가자만
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10);

  // 10등부터 1등까지 역순으로 정렬 (순차적 표시를 위해)
  const reversedParticipants = [...topParticipants].reverse();

  // 순차적으로 표시할 참가자 수
  const [visibleCount, setVisibleCount] = useState(0);

  // 순차적으로 참가자 표시 및 폭죽 효과
  useEffect(() => {
    if (reversedParticipants.length === 0) return;

    const interval = setInterval(() => {
      setVisibleCount(prev => {
        if (prev >= reversedParticipants.length) {
          clearInterval(interval);
          return prev;
        }

        // 현재 표시될 참가자의 순위 (역순이므로 계산 필요)
        const currentRank = reversedParticipants.length - prev;

        // 폭죽 효과
        const colors = currentRank <= 3
          ? ['#FFD700', '#FFA500', '#FF6347']
          : ['#4169E1', '#1E90FF', '#00BFFF'];

        confetti({
          particleCount: currentRank <= 3 ? 100 : 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: colors
        });

        // 1등일 때 추가 폭죽
        if (currentRank === 1) {
          setTimeout(() => {
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
              colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493']
            });
          }, 300);
        }

        return prev + 1;
      });
    }, 1500); // 1.5초마다 한 명씩 표시

    return () => clearInterval(interval);
  }, [reversedParticipants.length]);

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '';
    }
  };

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-yellow-600';
      case 2:
        return 'from-gray-300 to-gray-500';
      case 3:
        return 'from-orange-400 to-orange-600';
      default:
        return 'from-blue-400 to-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-4">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🏆 최종 순위 🏆</h1>
          <p className="text-xl text-gray-600">{quiz.title}</p>
          <p className="text-sm text-gray-500 mt-2">
            총 참여자: {session.participants.length}명 | 세션 ID: {sessionId.substring(0, 8)}...
          </p>
        </div>

        {/* 리더보드 */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            TOP 10 랭킹
          </h2>

          {topParticipants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">점수가 기록된 참가자가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reversedParticipants.map((participant, index) => {
                // 역순이므로 실제 순위는 역계산
                const rank = reversedParticipants.length - index;
                const medal = getMedalIcon(rank);
                const isTopThree = rank <= 3;

                // visibleCount에 따라 표시 여부 결정
                const isVisible = index < visibleCount;

                if (!isVisible) return null;

                return (
                  <div
                    key={participant.id}
                    className={`flex items-center gap-4 p-6 rounded-2xl transition-all transform animate-fade-in-up ${
                      isTopThree
                        ? `bg-gradient-to-r ${getMedalColor(rank)} text-white shadow-xl scale-105`
                        : 'bg-gray-50'
                    }`}
                    style={{
                      animation: 'fadeInUp 0.5s ease-out'
                    }}
                  >
                    {/* 순위 */}
                    <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl ${
                      isTopThree ? 'bg-white bg-opacity-30' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {medal || rank}
                    </div>

                    {/* 닉네임 */}
                    <div className="flex-grow">
                      <p className={`text-xl font-bold ${isTopThree ? 'text-white' : 'text-gray-800'}`}>
                        {participant.nickname}
                      </p>
                      <p className={`text-sm ${isTopThree ? 'text-white text-opacity-80' : 'text-gray-500'}`}>
                        {rank === 1 ? '🎉 최고 득점자!' : rank === 2 ? '👏 2등 달성!' : rank === 3 ? '🎊 3등 달성!' : `${rank}위`}
                      </p>
                    </div>

                    {/* 점수 */}
                    <div className={`flex-shrink-0 text-right ${isTopThree ? 'text-white' : 'text-gray-800'}`}>
                      <p className="text-3xl font-bold">{participant.score?.toLocaleString() ?? 0}</p>
                      <p className={`text-sm ${isTopThree ? 'text-white text-opacity-80' : 'text-gray-500'}`}>점</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/admin')}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
          >
            관리자 페이지로 돌아가기
          </button>
        </div>

        {/* QR 코드로 다시 참여하기 안내 */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            🎯 새로운 퀴즈를 시작하려면 관리자 페이지에서 세션을 생성하세요
          </p>
        </div>
      </div>
    </div>
  );
}
