'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToQuizSession, getQuiz, updateQuizSessionStatus } from '@/lib/firestore';
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

  // 세션 및 퀴즈 데이터 로드
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToQuizSession(sessionId, async (sessionData) => {
      setSession(sessionData);

      // 퀴즈 정보 가져오기
      if (sessionData.quizId && !quiz) {
        try {
          const quizData = await getQuiz(sessionData.quizId);
          setQuiz(quizData);
          setLoading(false);
        } catch (err) {
          console.error('퀴즈 가져오기 실패:', err);
          setError('퀴즈 정보를 불러올 수 없습니다.');
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

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
      alert('퀴즈가 종료되었습니다.');
      router.push('/admin');
    } catch (err) {
      console.error('퀴즈 종료 실패:', err);
      alert('퀴즈 종료에 실패했습니다.');
    }
  };

  const handleNextQuestion = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

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
  const participantCount = session.participants?.length || 0;
  const currentAnswers = session.answers?.filter(a => a.questionIndex === currentQuestionIndex) || [];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{quiz.title}</h1>
              <p className="text-gray-600 mt-1">
                세션 ID: {sessionId.substring(0, 8)}... | 상태:{' '}
                <span
                  className={`font-semibold ${
                    session.status === 'waiting'
                      ? 'text-yellow-600'
                      : session.status === 'active'
                      ? 'text-green-600'
                      : 'text-gray-600'
                  }`}
                >
                  {session.status === 'waiting' ? '대기 중' : session.status === 'active' ? '진행 중' : '종료됨'}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              {session.status === 'waiting' && (
                <button
                  onClick={handleStartQuiz}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold"
                >
                  퀴즈 시작
                </button>
              )}
              {session.status === 'active' && (
                <button
                  onClick={handleEndQuiz}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-semibold"
                >
                  퀴즈 종료
                </button>
              )}
              <button
                onClick={() => router.push('/admin')}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 font-semibold"
              >
                관리자 페이지
              </button>
            </div>
          </div>

          {/* 참가자 정보 */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">총 참가자</p>
              <p className="text-2xl font-bold text-blue-600">{participantCount}명</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">현재 문제</p>
              <p className="text-2xl font-bold text-green-600">
                {currentQuestionIndex + 1} / {quiz.questions.length}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">응답 수</p>
              <p className="text-2xl font-bold text-purple-600">{currentAnswers.length}명</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 왼쪽: 현재 문제 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                문제 {currentQuestionIndex + 1}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className={`px-4 py-2 rounded ${
                    currentQuestionIndex === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  ← 이전
                </button>
                <button
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex >= quiz.questions.length - 1}
                  className={`px-4 py-2 rounded ${
                    currentQuestionIndex >= quiz.questions.length - 1
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  다음 →
                </button>
              </div>
            </div>

            {/* 문제 내용 */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{currentQuestion.question}</h3>

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
                      idx === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{idx + 1}.</span>
                      <span>{option}</span>
                      {idx === currentQuestion.correctAnswer && (
                        <span className="ml-auto text-green-600 font-semibold">✓ 정답</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-gray-600">
                제한 시간: {currentQuestion.timeLimit}초
              </div>
            </div>
          </div>

          {/* 오른쪽: 참가자 및 응답 현황 */}
          <div className="space-y-6">
            {/* 참가자 목록 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">참가자 목록</h2>
              {participantCount === 0 ? (
                <p className="text-gray-500 text-center py-4">아직 참가자가 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {session.participants?.map((participant, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{participant.nickname}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(participant.joinedAt).toLocaleTimeString('ko-KR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 현재 문제 응답 현황 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                현재 문제 응답 현황 ({currentAnswers.length}명)
              </h2>
              {currentAnswers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">아직 응답이 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {currentAnswers.map((answer, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        answer.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{answer.participantName}</span>
                        <span className={`font-semibold ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {answer.isCorrect ? '✓ 정답' : '✗ 오답'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        선택: {answer.answer + 1}번 | 응답 시간: {answer.responseTime.toFixed(1)}초
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
