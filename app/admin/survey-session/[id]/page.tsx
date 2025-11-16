'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { subscribeToSurveySession, getSurvey } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import { exportSurveyComparisonToSheets, isGoogleSheetsEnabled } from '@/lib/googleSheets';
import type { Survey, SurveySession, SurveyStats } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SurveySessionPage({ params }: PageProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');
  const [session, setSession] = useState<SurveySession | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [exporting, setExporting] = useState(false);

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

    const unsubscribe = subscribeToSurveySession(sessionId, (sessionData) => {
      setTimeout(() => {
        setSession(sessionData);
      }, 0);
    });

    return () => unsubscribe();
  }, [sessionId]);

  // 설문 데이터 로드
  useEffect(() => {
    async function loadSurvey() {
      if (!session?.surveyId) return;

      try {
        const surveyData = await getSurvey(session.surveyId);
        if (surveyData) {
          setSurvey(surveyData);
        } else {
          setError('설문을 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('설문 로드 실패:', err);
        setError('설문을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadSurvey();
  }, [session?.surveyId]);

  // 통계 계산
  const calculateStats = (): SurveyStats => {
    if (!session?.responses) {
      return {
        totalResponses: 0,
        scaleDistribution: {
          stronglyAgree: 0,
          agree: 0,
          neutral: 0,
          disagree: 0,
          stronglyDisagree: 0,
        },
        averageScore: 0,
        textResponses: [],
      };
    }

    const scaleDistribution = {
      stronglyAgree: 0,    // +2
      agree: 0,            // +1
      neutral: 0,          // 0
      disagree: 0,         // -1
      stronglyDisagree: 0, // -2
    };

    let totalScore = 0;
    const textResponses: string[] = [];

    session.responses.forEach((response: any) => {
      if (response.scaleValue !== undefined && response.scaleValue !== null) {
        totalScore += response.scaleValue;

        switch (response.scaleValue) {
          case 2:
            scaleDistribution.stronglyAgree++;
            break;
          case 1:
            scaleDistribution.agree++;
            break;
          case 0:
            scaleDistribution.neutral++;
            break;
          case -1:
            scaleDistribution.disagree++;
            break;
          case -2:
            scaleDistribution.stronglyDisagree++;
            break;
        }
      }

      if (response.textValue) {
        textResponses.push(response.textValue);
      }
    });

    const totalResponses = session.responses.length;
    const averageScore = totalResponses > 0 ? totalScore / totalResponses : 0;

    return {
      totalResponses,
      scaleDistribution,
      averageScore,
      textResponses,
    };
  };

  const stats = calculateStats();

  // 시트로 내보내기 핸들러
  const handleExportToSheets = async () => {
    if (!auth.currentUser || !survey) return;

    try {
      setExporting(true);

      // 학생 결과 총합 계산
      const studentTotal = survey.studentResultData
        ? Object.values(survey.studentResultData).reduce((sum, val) => sum + val, 0)
        : 0;

      // 학부모 결과 총합 계산
      const parentTotal = survey.parentResultData
        ? Object.values(survey.parentResultData).reduce((sum, val) => sum + val, 0)
        : 0;

      await exportSurveyComparisonToSheets(
        {
          surveyTitle: survey.title,
          surveyQuestion: survey.question,
          teacherResults: {
            stronglyAgree: stats.scaleDistribution.stronglyAgree,
            agree: stats.scaleDistribution.agree,
            neutral: stats.scaleDistribution.neutral,
            disagree: stats.scaleDistribution.disagree,
            stronglyDisagree: stats.scaleDistribution.stronglyDisagree,
            total: stats.totalResponses,
          },
          studentResults: survey.studentResultData
            ? {
                ...survey.studentResultData,
                total: studentTotal,
              }
            : undefined,
          parentResults: survey.parentResultData
            ? {
                ...survey.parentResultData,
                total: parentTotal,
              }
            : undefined,
          timestamp: new Date(),
        },
        auth.currentUser.uid
      );

      alert('설문 결과가 Google Sheets에 저장되었습니다!');
    } catch (err: any) {
      console.error('시트 내보내기 실패:', err);
      alert(err.message || '시트 내보내기에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !session || !survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
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
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            관리자 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{survey.title}</h1>
              <p className="text-gray-600">{survey.question}</p>
            </div>
            <div className="flex gap-3">
              {isGoogleSheetsEnabled() && (
                <button
                  onClick={handleExportToSheets}
                  disabled={exporting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      내보내는 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      시트로 내보내기
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => router.push('/admin')}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
              >
                관리자 페이지로
              </button>
            </div>
          </div>
        </div>

        {/* QR 코드 표시 버튼 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">참여자 접속</h2>
              <p className="text-gray-600">QR 코드를 스캔하여 참여하세요</p>
            </div>
            <button
              onClick={() => setShowQRModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              QR 코드 보기
            </button>
          </div>
        </div>

        {/* 참여자 수 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">참여 현황</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-1">현재 참여자</p>
              <p className="text-3xl font-bold text-blue-600">{session.participants?.length || 0}명</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-1">응답 완료</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalResponses}명</p>
            </div>
          </div>
        </div>

        {/* 3개 결과 비교 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 설문 결과 비교</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 교사 결과 (실시간) */}
            <div className="border-2 border-green-500 rounded-xl p-6">
              <h3 className="text-lg font-bold text-green-700 mb-4 text-center">👩‍🏫 교사 (실시간)</h3>

              {stats.totalResponses > 0 ? (
                <>
                  {/* 평균 점수 */}
                  <div className="bg-green-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-600 text-center mb-1">평균 점수</p>
                    <p className="text-4xl font-bold text-center text-green-600">
                      {stats.averageScore.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 text-center mt-1">(-2 ~ +2)</p>
                  </div>

                  {/* 5점 척도 분포 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">적극 찬성</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-green-600 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ width: `${stats.totalResponses > 0 ? (stats.scaleDistribution.stronglyAgree / stats.totalResponses) * 100 : 0}%` }}
                        >
                          {stats.scaleDistribution.stronglyAgree}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">찬성</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-green-500 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ width: `${stats.totalResponses > 0 ? (stats.scaleDistribution.agree / stats.totalResponses) * 100 : 0}%` }}
                        >
                          {stats.scaleDistribution.agree}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">보통</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-gray-500 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ width: `${stats.totalResponses > 0 ? (stats.scaleDistribution.neutral / stats.totalResponses) * 100 : 0}%` }}
                        >
                          {stats.scaleDistribution.neutral}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">반대</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-orange-500 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ width: `${stats.totalResponses > 0 ? (stats.scaleDistribution.disagree / stats.totalResponses) * 100 : 0}%` }}
                        >
                          {stats.scaleDistribution.disagree}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">적극 반대</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-red-600 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ width: `${stats.totalResponses > 0 ? (stats.scaleDistribution.stronglyDisagree / stats.totalResponses) * 100 : 0}%` }}
                        >
                          {stats.scaleDistribution.stronglyDisagree}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>아직 응답이 없습니다</p>
                </div>
              )}
            </div>

            {/* 학생 결과 */}
            <div className="border-2 border-blue-500 rounded-xl p-6">
              <h3 className="text-lg font-bold text-blue-700 mb-4 text-center">👦 학생</h3>

              {survey.studentResultImageUrl ? (
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={survey.studentResultImageUrl}
                    alt="학생 설문 결과"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">결과 이미지 없음</p>
                  <p className="text-xs mt-1">설문 수정에서 업로드</p>
                </div>
              )}
            </div>

            {/* 학부모 결과 */}
            <div className="border-2 border-purple-500 rounded-xl p-6">
              <h3 className="text-lg font-bold text-purple-700 mb-4 text-center">👨‍👩‍👧 학부모</h3>

              {survey.parentResultImageUrl ? (
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={survey.parentResultImageUrl}
                    alt="학부모 설문 결과"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">결과 이미지 없음</p>
                  <p className="text-xs mt-1">설문 수정에서 업로드</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR 코드 모달 */}
      {showQRModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">참여 QR 코드</h3>

            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <div className="inline-block p-4 bg-white rounded-lg shadow-md mx-auto">
                <QRCodeSVG
                  value={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${typeof window !== 'undefined' ? window.location.port : '3000'}/participant?survey=${survey.id}&session=${sessionId}`}
                  size={280}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>

            <p className="text-center text-gray-600 text-sm mb-4">
              참여자가 이 QR 코드를 스캔하여 설문에 참여할 수 있습니다
            </p>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
