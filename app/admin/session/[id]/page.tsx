'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type SessionStatus = 'waiting' | 'active' | 'finished';
type SessionType = 'quiz' | 'survey';

export default function SessionControlPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [sessionType, setSessionType] = useState<SessionType>('quiz');
  const [status, setStatus] = useState<SessionStatus>('waiting');
  const [timeLeft, setTimeLeft] = useState(10);
  const [participants, setParticipants] = useState<any[]>([
    { id: '1', nickname: '김선생', joinedAt: new Date() },
    { id: '2', nickname: '이선생', joinedAt: new Date() },
    { id: '3', nickname: '박선생', joinedAt: new Date() },
  ]);

  // 임시 퀴즈 데이터
  const quiz = {
    title: '2024 교육과정 이해도',
    question: '2024년 교육과정의 핵심 목표는 무엇인가요?',
    options: ['학생 중심 교육', '디지털 역량 강화', '창의융합형 인재 양성', '기초학력 보장'],
    correctAnswer: 2,
    timeLimit: 10,
  };

  // 임시 응답 데이터
  const [answers, setAnswers] = useState<any[]>([
    { participantId: '1', participantName: '김선생', answer: 2, isCorrect: true, responseTime: 2345 },
    { participantId: '2', participantName: '이선생', answer: 1, isCorrect: false, responseTime: 4123 },
  ]);

  const handleStart = () => {
    setStatus('active');
  };

  const handleFinish = () => {
    setStatus('finished');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 헤더 */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
              <p className="text-sm text-gray-500 mt-1">세션 ID: {sessionId}</p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ← 돌아가기
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 왼쪽: 세션 컨트롤 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 상태 카드 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">세션 상태</h2>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className={`w-3 h-3 rounded-full ${
                      status === 'waiting' ? 'bg-yellow-500' :
                      status === 'active' ? 'bg-green-500 animate-pulse' :
                      'bg-gray-500'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-600">
                      {status === 'waiting' ? '대기중' :
                       status === 'active' ? '진행중' :
                       '종료'}
                    </span>
                  </div>
                </div>

                {/* 타이머 */}
                {status === 'active' && (
                  <div className="text-center">
                    <div className="text-5xl font-bold text-red-500 mb-2">
                      {timeLeft}
                    </div>
                    <div className="text-sm text-gray-500">초 남음</div>
                  </div>
                )}
              </div>

              {/* 질문 표시 */}
              <div className="bg-blue-50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">{quiz.question}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {quiz.options.map((option, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        index === quiz.correctAnswer
                          ? 'bg-green-100 border-2 border-green-500'
                          : 'bg-white border-2 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-700">{index + 1}.</span>
                        <span className="text-gray-800">{option}</span>
                        {index === quiz.correctAnswer && (
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 컨트롤 버튼 */}
              <div className="flex space-x-3">
                {status === 'waiting' && (
                  <button
                    onClick={handleStart}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-bold text-lg shadow-lg"
                  >
                    🚀 세션 시작
                  </button>
                )}
                {status === 'active' && (
                  <button
                    onClick={handleFinish}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:from-red-700 hover:to-rose-700 transition-all font-bold text-lg shadow-lg"
                  >
                    ⏹ 세션 종료
                  </button>
                )}
                {status === 'finished' && (
                  <div className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-xl text-center font-bold text-lg">
                    세션 종료됨
                  </div>
                )}
              </div>
            </div>

            {/* 실시간 응답 현황 */}
            {status !== 'waiting' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">실시간 응답 현황</h2>

                {/* 답변 분포 */}
                <div className="space-y-3 mb-6">
                  {quiz.options.map((option, index) => {
                    const count = answers.filter(a => a.answer === index).length;
                    const percentage = participants.length > 0 ? (count / participants.length) * 100 : 0;
                    return (
                      <div key={index}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {index + 1}. {option}
                            {index === quiz.correctAnswer && (
                              <span className="ml-2 text-green-600">✓</span>
                            )}
                          </span>
                          <span className="text-sm font-bold text-gray-800">{count}명 ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              index === quiz.correctAnswer ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 빠른 정답자 */}
                <div className="bg-yellow-50 rounded-xl p-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">🏆 빠른 정답자 TOP 3</h3>
                  <div className="space-y-2">
                    {answers
                      .filter(a => a.isCorrect)
                      .sort((a, b) => a.responseTime - b.responseTime)
                      .slice(0, 3)
                      .map((answer, index) => (
                        <div key={answer.participantId} className="flex items-center justify-between bg-white rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              'bg-orange-300 text-orange-900'
                            }`}>
                              {index + 1}
                            </div>
                            <span className="font-semibold text-gray-800">{answer.participantName}</span>
                          </div>
                          <span className="text-sm text-gray-600">{(answer.responseTime / 1000).toFixed(2)}초</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* 최종 통계 */}
            {status === 'finished' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📊 최종 통계</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">{participants.length}</div>
                    <div className="text-sm text-gray-600 mt-1">총 참여자</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {answers.filter(a => a.isCorrect).length}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">정답자</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {participants.length > 0
                        ? ((answers.filter(a => a.isCorrect).length / participants.length) * 100).toFixed(0)
                        : 0}%
                    </div>
                    <div className="text-sm text-gray-600 mt-1">정답률</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 참여자 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                참여자 ({participants.length}명)
              </h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {participants.map((participant) => {
                  const hasAnswered = answers.some(a => a.participantId === participant.id);
                  const participantAnswer = answers.find(a => a.participantId === participant.id);

                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">
                            {participant.nickname.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">
                          {participant.nickname}
                        </span>
                      </div>
                      {hasAnswered && (
                        <div className="flex items-center space-x-2">
                          {participantAnswer?.isCorrect ? (
                            <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
