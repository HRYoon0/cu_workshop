'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import { getQuiz, getSurvey, subscribeToQuizSession, addParticipantToQuizSession, removeParticipantFromQuizSession, updateParticipantHeartbeat, submitQuizAnswer, updateParticipantScore } from '@/lib/firestore';
import type { QuizSession } from '@/lib/types';

type ViewType = 'nickname' | 'waiting' | 'quiz' | 'survey' | 'result' | 'error';

function ParticipantContent() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewType>('nickname');
  const [nickname, setNickname] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [quizData, setQuizData] = useState<any>(null);
  const [surveyData, setSurveyData] = useState<any>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const quizId = searchParams.get('quiz');
  const surveyId = searchParams.get('survey');
  const sessionId = searchParams.get('session');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        if (quizId) {
          const quiz = await getQuiz(quizId);
          if (quiz) {
            setQuizData(quiz);
          } else {
            setError('퀴즈를 찾을 수 없습니다.');
            setView('error');
          }
        } else if (surveyId) {
          const survey = await getSurvey(surveyId);
          if (survey) {
            setSurveyData(survey);
          } else {
            setError('설문을 찾을 수 없습니다.');
            setView('error');
          }
        } else {
          setError('잘못된 접근입니다. QR 코드를 다시 스캔해주세요.');
          setView('error');
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
        setView('error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [quizId, surveyId]);

  // 세션 상태 구독
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToQuizSession(sessionId, (sessionData) => {
      // state 업데이트를 다음 tick으로 미루어 React error #310 방지
      setTimeout(() => {
        setSession(sessionData);
      }, 0);
    });

    return () => unsubscribe();
  }, [sessionId]);

  // 세션 상태가 active로 변경되면 퀴즈/설문 시작
  useEffect(() => {
    if (session?.status === 'active' && view === 'waiting') {
      setView(quizData ? 'quiz' : 'survey');
    }
    // 세션이 종료되면 결과 화면으로
    if (session?.status === 'finished' && (view === 'quiz' || view === 'survey' || view === 'waiting')) {
      setView('result');
    }
  }, [session?.status, view, quizData]);

  const handleNicknameSubmit = async () => {
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return;
    }

    if (!sessionId) {
      setError('세션 ID가 없습니다. QR 코드를 다시 스캔해주세요.');
      setView('error');
      return;
    }

    try {
      // 고유한 참가자 ID 생성
      const newParticipantId = Date.now().toString();
      setParticipantId(newParticipantId);

      // 세션에 참가자 추가 (joinedAt, lastActiveAt은 함수에서 자동 설정됨)
      await addParticipantToQuizSession(sessionId, {
        id: newParticipantId,
        nickname: nickname,
      } as any);

      console.log('참가 완료:', nickname, newParticipantId);
      setView('waiting');
    } catch (err: any) {
      console.error('참가자 추가 실패:', err);
      setError(err?.message || '참가 신청에 실패했습니다. 다시 시도해주세요.');
      setView('error');
    }
  };

  // Heartbeat 시스템 (페이지가 보일 때만 전송)
  useEffect(() => {
    if (!sessionId || !participantId) {
      console.log('Heartbeat: sessionId 또는 participantId 없음', sessionId, participantId);
      return;
    }

    console.log('Heartbeat 시스템 시작:', participantId);
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const sendHeartbeat = () => {
      console.log('Heartbeat 전송 중...', participantId);
      updateParticipantHeartbeat(sessionId, participantId);
    };

    // Page Visibility API
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('페이지가 다시 보임 - heartbeat 재시작');
        sendHeartbeat();
        if (!heartbeatInterval) {
          heartbeatInterval = setInterval(sendHeartbeat, 3000);
        }
      } else {
        console.log('페이지가 숨겨짐 - heartbeat 중지');
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      }
    };

    // 초기 heartbeat 및 interval 시작
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 3000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup (async 작업 없음)
    return () => {
      console.log('Heartbeat 시스템 종료');
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, participantId]);

  // beforeunload로 페이지 종료 시 제거 (cleanup 함수가 아님)
  useEffect(() => {
    if (!sessionId || !participantId) return;

    const handleBeforeUnload = () => {
      // 동기 방식으로 처리
      navigator.sendBeacon(`/api/leave?session=${sessionId}&participant=${participantId}`);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, participantId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">오류 발생</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {view === 'nickname' && (
        <NicknameInput
          nickname={nickname}
          setNickname={setNickname}
          onSubmit={handleNicknameSubmit}
          title={quizData?.title || surveyData?.title || ''}
        />
      )}
      {view === 'waiting' && (
        <WaitingRoom
          nickname={nickname}
          sessionStatus={session?.status || 'waiting'}
        />
      )}
      {view === 'quiz' && quizData && sessionId && session && participantId && (
        <QuizView nickname={nickname} quiz={quizData} sessionId={sessionId} session={session} participantId={participantId} />
      )}
      {view === 'survey' && surveyData && (
        <SurveyView nickname={nickname} survey={surveyData} />
      )}
      {view === 'result' && session && participantId && (
        <FinalResultView nickname={nickname} session={session} participantId={participantId} />
      )}
    </div>
  );
}

// 닉네임 입력 화면
function NicknameInput({
  nickname,
  setNickname,
  onSubmit,
  title,
}: {
  nickname: string;
  setNickname: (name: string) => void;
  onSubmit: () => void;
  title: string;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      onSubmit();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 로고/헤더 */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            교육과정 워크숍
          </h1>
          <p className="text-gray-600">실시간 퀴즈 & 설문</p>
        </div>

        {/* 닉네임 입력 폼 */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            닉네임을 입력하세요
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-200 focus:border-purple-500 transition-all"
                placeholder="예: 김선생님"
                maxLength={20}
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                다른 참여자들에게 표시될 이름입니다
              </p>
            </div>

            <button
              type="submit"
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-bold rounded-2xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              참여하기
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← 홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// 대기실
function WaitingRoom({
  nickname,
  sessionStatus,
}: {
  nickname: string;
  sessionStatus: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {/* 애니메이션 아이콘 */}
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse-slow">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {sessionStatus === 'waiting' ? '대기 중...' : '시작 준비 중...'}
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            안녕하세요, <span className="font-bold text-purple-600">{nickname}</span>님!
          </p>

          <div className="bg-blue-50 rounded-2xl p-6 mb-6">
            <p className="text-gray-700">
              관리자가 퀴즈 또는 설문을 시작할 때까지 기다려주세요.
            </p>
          </div>

          {/* 로딩 애니메이션 */}
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 퀴즈 화면
function QuizView({ nickname, quiz, sessionId, session, participantId }: { nickname: string; quiz: any; sessionId: string; session: any; participantId: string }) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(session?.currentQuestionIndex || 0);
  const [timeLeft, setTimeLeft] = useState(quiz.questions[session?.currentQuestionIndex || 0]?.timeLimit || 10);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [earnedScore, setEarnedScore] = useState<number>(0); // 이번 문제에서 획득한 점수

  const currentQuestion = quiz.questions[currentQuestionIndex];

  // 현재 참가자의 총 점수 가져오기
  const currentParticipant = session?.participants?.find((p: any) => p.id === participantId);
  const totalScore = currentParticipant?.score ?? 0;

  // 세션의 currentQuestionIndex 변경 감지
  useEffect(() => {
    if (session?.currentQuestionIndex !== undefined && session.currentQuestionIndex !== currentQuestionIndex) {
      console.log('문제 변경 감지:', session.currentQuestionIndex + 1);
      setCurrentQuestionIndex(session.currentQuestionIndex);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setEarnedScore(0); // 획득 점수 초기화
      setStartTime(Date.now());
      setTimeLeft(quiz.questions[session.currentQuestionIndex]?.timeLimit || 10);
    }
  }, [session?.currentQuestionIndex, currentQuestionIndex, quiz]);

  // 타이머
  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  // 시간 초과 시 자동 제출
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isSubmitted]);

  const handleSubmit = async () => {
    if (selectedAnswer === null && timeLeft > 0) return;

    const responseTime = (Date.now() - startTime) / 1000; // 초 단위
    const answer = selectedAnswer !== null ? selectedAnswer : -1; // 시간 초과 시 -1
    const isCorrect = answer === currentQuestion.correctAnswer;

    try {
      // 답안 제출
      await submitQuizAnswer(sessionId, {
        participantId: participantId,
        participantName: nickname,
        questionIndex: currentQuestionIndex,
        answer: answer,
        isCorrect: isCorrect,
        timestamp: new Date(),
        responseTime: responseTime,
      }, quiz.title);

      let scoreEarned = 0;
      // 점수 계산: 정답일 경우에만 점수 부여
      if (isCorrect) {
        // 기본 점수 1000점 + (남은 시간 * 100점)
        // 빠르게 답할수록 높은 점수
        const baseScore = 1000;
        const timeBonus = Math.floor(timeLeft * 100);
        scoreEarned = baseScore + timeBonus;

        console.log(`점수 계산: ${baseScore} + (${timeLeft}초 * 100) = ${scoreEarned}점`);

        // 점수 업데이트
        await updateParticipantScore(sessionId, participantId, scoreEarned);
      }

      setEarnedScore(scoreEarned); // 획득 점수 저장
      setIsSubmitted(true);
    } catch (err) {
      console.error('답안 제출 실패:', err);
      alert('답안 제출에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* 상단 정보 바 */}
        <div className="bg-white rounded-t-3xl shadow-lg p-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">{nickname.charAt(0)}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-800 block">{nickname}</span>
              <span className="text-xs text-purple-600 font-bold">⭐ {totalScore.toLocaleString()}점</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="text-2xl font-bold text-red-500">{timeLeft}초</span>
          </div>
        </div>

        {/* 퀴즈 컨텐츠 */}
        <div className="bg-white rounded-b-3xl shadow-2xl p-8">
          {!isSubmitted ? (
            <>
              {/* 질문 */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-purple-600">
                    질문 {currentQuestionIndex + 1} / {quiz.questions.length}
                  </span>
                  <span className="text-sm text-gray-500">{quiz.title}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  {currentQuestion.question}
                </h2>

                {/* 이미지 (있을 경우) */}
                {currentQuestion.imageUrl && (
                  <div className="mb-6 rounded-xl overflow-hidden">
                    <img
                      src={currentQuestion.imageUrl}
                      alt="퀴즈 이미지"
                      className="w-full max-h-96 object-contain bg-gray-50"
                    />
                  </div>
                )}
              </div>

              {/* 선택지 */}
              <div className="space-y-4 mb-8">
                {currentQuestion.options.map((option: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAnswer(index)}
                    className={`w-full p-6 rounded-2xl text-left transition-all transform hover:scale-105 ${
                      selectedAnswer === index
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        selectedAnswer === index ? 'bg-white text-purple-600' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="text-lg font-semibold">{option}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* 제출 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={selectedAnswer === null}
                className={`w-full py-4 rounded-2xl text-xl font-bold transition-all shadow-lg ${
                  selectedAnswer !== null
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transform hover:-translate-y-1'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {selectedAnswer !== null ? '답안 제출하기' : '답을 선택하세요'}
              </button>
            </>
          ) : (
            <ResultView
              isCorrect={selectedAnswer !== null && selectedAnswer === currentQuestion.correctAnswer}
              correctAnswer={currentQuestion.correctAnswer}
              selectedAnswer={selectedAnswer !== null ? selectedAnswer : -1}
              options={currentQuestion.options}
              earnedScore={earnedScore}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 결과 화면
function ResultView({
  isCorrect,
  correctAnswer,
  selectedAnswer,
  options,
  earnedScore,
}: {
  isCorrect: boolean;
  correctAnswer: number;
  selectedAnswer: number;
  options: string[];
  earnedScore: number;
}) {
  // 정답일 때 폭죽 효과
  useEffect(() => {
    if (isCorrect) {
      // 여러 번 폭죽 터뜨리기
      const duration = 2000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1']
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isCorrect]);

  return (
    <div className="text-center">
      {/* 결과 아이콘 */}
      <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${
        isCorrect ? 'bg-green-100' : 'bg-red-100'
      }`}>
        {isCorrect ? (
          <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      {/* 결과 메시지 */}
      <h3 className={`text-4xl font-bold mb-4 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
        {isCorrect ? '정답입니다!' : selectedAnswer === -1 ? '시간 초과!' : '오답입니다'}
      </h3>

      {/* 획득 점수 표시 */}
      {isCorrect && earnedScore > 0 && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 mb-6 animate-bounce">
          <p className="text-white font-bold text-2xl mb-2">🎉 획득 점수 🎉</p>
          <p className="text-white font-bold text-5xl">+{earnedScore.toLocaleString()}점</p>
        </div>
      )}

      {!isCorrect && (
        <div className="bg-blue-50 rounded-2xl p-6 mb-6">
          <p className="text-gray-700 mb-2">정답은</p>
          <p className="text-xl font-bold text-blue-600">
            {correctAnswer + 1}번: {options[correctAnswer]}
          </p>
        </div>
      )}

      <p className="text-gray-600 text-lg">
        다음 문제를 기다려주세요...
      </p>
    </div>
  );
}

// 설문 화면
function SurveyView({ nickname, survey }: { nickname: string; survey: any }) {
  const [scaleValue, setScaleValue] = useState<number | null>(null);
  const [textValue, setTextValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(survey.timeLimit || 60);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const scaleOptions = [
    { value: 2, label: '적극 찬성', color: 'from-green-600 to-emerald-600' },
    { value: 1, label: '찬성', color: 'from-green-500 to-emerald-500' },
    { value: 0, label: '보통', color: 'from-gray-500 to-gray-600' },
    { value: -1, label: '반대', color: 'from-orange-500 to-red-500' },
    { value: -2, label: '적극 반대', color: 'from-red-600 to-rose-700' },
  ];

  const handleSubmit = () => {
    if (scaleValue !== null) {
      setIsSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* 상단 정보 바 */}
        <div className="bg-white rounded-t-3xl shadow-lg p-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">{nickname.charAt(0)}</span>
            </div>
            <span className="font-semibold text-gray-800">{nickname}</span>
          </div>
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="text-2xl font-bold text-blue-500">{timeLeft}초</span>
          </div>
        </div>

        {/* 설문 컨텐츠 */}
        <div className="bg-white rounded-b-3xl shadow-2xl p-8">
          {!isSubmitted ? (
            <>
              {/* 질문 */}
              <div className="mb-8">
                <div className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-4">
                  설문조사
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  {survey.question}
                </h2>

                {/* 이미지 (있을 경우) */}
                {survey.imageUrl && (
                  <div className="mb-6 rounded-xl overflow-hidden">
                    <img
                      src={survey.imageUrl}
                      alt="설문 이미지"
                      className="w-full max-h-96 object-contain bg-gray-50"
                    />
                  </div>
                )}
              </div>

              {/* 5점 척도 */}
              <div className="space-y-4 mb-8">
                {scaleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setScaleValue(option.value)}
                    className={`w-full p-6 rounded-2xl text-left transition-all transform hover:scale-105 ${
                      scaleValue === option.value
                        ? `bg-gradient-to-r ${option.color} text-white shadow-xl`
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">{option.label}</span>
                      {scaleValue === option.value && (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* 기타 의견 */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  기타 의견 (선택사항)
                </label>
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all resize-none"
                  rows={4}
                  placeholder="추가 의견이 있으시면 자유롭게 작성해주세요..."
                />
              </div>

              {/* 제출 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={scaleValue === null}
                className={`w-full py-4 rounded-2xl text-xl font-bold transition-all shadow-lg ${
                  scaleValue !== null
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transform hover:-translate-y-1'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {scaleValue !== null ? '의견 제출하기' : '답변을 선택하세요'}
              </button>
            </>
          ) : (
            <SurveySubmitted />
          )}
        </div>
      </div>
    </div>
  );
}

// 설문 제출 완료
function SurveySubmitted() {
  return (
    <div className="text-center py-8">
      <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-4xl font-bold text-green-600 mb-4">
        제출 완료!
      </h3>
      <p className="text-gray-600 text-lg">
        소중한 의견 감사합니다
      </p>
    </div>
  );
}

// 최종 결과 화면
function FinalResultView({ nickname, session, participantId }: { nickname: string; session: any; participantId: string }) {
  const currentParticipant = session?.participants?.find((p: any) => p.id === participantId);
  const totalScore = currentParticipant?.score ?? 0;

  // 점수별 순위 계산
  const sortedParticipants = [...(session?.participants || [])]
    .filter(p => (p.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const rank = sortedParticipants.findIndex(p => p.id === participantId) + 1;
  const totalParticipants = sortedParticipants.length;

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {/* 순위 아이콘 */}
          <div className="mb-6">
            <div className="text-8xl mb-4">{getMedalIcon(rank)}</div>
            <h2 className="text-5xl font-bold text-gray-800 mb-2">
              {rank}등
            </h2>
            <p className="text-xl text-gray-600">
              {nickname}님의 최종 순위
            </p>
          </div>

          {/* 점수 표시 */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-8 mb-6">
            <p className="text-white text-2xl mb-2">최종 점수</p>
            <p className="text-white font-bold text-6xl mb-2">{totalScore.toLocaleString()}</p>
            <p className="text-white text-lg">점</p>
          </div>

          {/* 상위 % 표시 */}
          {totalParticipants > 0 && (
            <div className="bg-blue-50 rounded-2xl p-6 mb-6">
              <p className="text-gray-700 text-lg">
                전체 <span className="font-bold text-blue-600">{totalParticipants}명</span> 중{' '}
                <span className="font-bold text-blue-600">{rank}등</span>
              </p>
              <p className="text-gray-600 text-sm mt-2">
                상위 {Math.round((rank / totalParticipants) * 100)}%
              </p>
            </div>
          )}

          {/* 격려 메시지 */}
          <div className="mt-8">
            {rank === 1 && (
              <p className="text-2xl font-bold text-yellow-500">🎉 최고 득점자입니다! 축하합니다! 🎉</p>
            )}
            {rank === 2 && (
              <p className="text-2xl font-bold text-gray-500">👏 2등! 정말 잘하셨습니다! 👏</p>
            )}
            {rank === 3 && (
              <p className="text-2xl font-bold text-orange-500">🎊 3등! 훌륭합니다! 🎊</p>
            )}
            {rank > 3 && (
              <p className="text-xl font-bold text-blue-600">🌟 수고하셨습니다! 🌟</p>
            )}
          </div>

          {/* 하단 메시지 */}
          <p className="text-gray-500 mt-8">
            퀴즈에 참여해주셔서 감사합니다!
          </p>
        </div>
      </div>
    </div>
  );
}

// Suspense로 감싼 메인 컴포넌트
export default function ParticipantPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    }>
      <ParticipantContent />
    </Suspense>
  );
}
