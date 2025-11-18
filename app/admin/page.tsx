'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  createQuiz,
  createSurvey,
  getQuizzes,
  getSurveys,
  deleteQuiz,
  deleteSurvey,
  updateQuiz,
  updateSurvey,
  createQuizSession,
  createSurveySession,
  isApprovedUser,
  getPendingUsers,
  approveUser,
  rejectUser,
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  getAllUserSheets,
  getUserSheet,
  saveUserSheet,
  createOpinionSession,
  getOpinions,
  subscribeToOpinions,
  updateOpinionSessionStatus,
  getActiveOpinionSession,
  deleteOpinionSession,
  cleanOldUserSheetHistory
} from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import ImageUploader from '@/components/ImageUploader';
import { renameSchoolFolder, findOrCreateFolder } from '@/lib/googleDrive';
import { QRCodeSVG } from 'qrcode.react';
import {
  updateSchoolNameInAllTabs,
  addSheetTab,
  deleteSheetTab,
  renameSheetTab,
  duplicateSheetTab,
  setupSheetTabData,
  getSheetTabs,
  initializeUserSheet,
  getDiscussionItems,
  addDiscussionItem,
  updateDiscussionItem,
  deleteDiscussionItem
} from '@/lib/googleSheets';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'quiz' | 'survey' | 'discussion' | 'approval'>('quiz');
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('2025학년도 경남초등학교 교육과정 워크숍');
  const [showSchoolNameModal, setShowSchoolNameModal] = useState(false);
  const [tempSchoolName, setTempSchoolName] = useState('');

  useEffect(() => {
    // 저장된 학교 이름 불러오기
    const savedSchoolName = localStorage.getItem('schoolName');
    if (savedSchoolName) {
      setSchoolName(savedSchoolName);
    }
  }, []);

  useEffect(() => {
    // 로그인 상태 확인
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        // 로그인되지 않음 -> 로그인 페이지로
        setTimeout(() => router.push('/login'), 0);
        return;
      }

      // 승인된 사용자인지 확인
      const approved = await isApprovedUser(currentUser.uid);
      if (!approved) {
        // 승인되지 않음 -> 대기 화면으로
        setTimeout(() => router.push('/waiting-approval'), 0);
        return;
      }

      // 관리자인지 확인
      const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
      const isAdminUser = currentUser.uid === adminUid;

      // state 업데이트를 다음 tick으로 미루어 React error #310 방지
      setTimeout(() => {
        setUser(currentUser);
        setIsAdmin(isAdminUser);
        setLoading(false);
      }, 0);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  const handleSchoolNameSave = async () => {
    if (!tempSchoolName.trim()) {
      return;
    }

    try {
      const newName = tempSchoolName.trim();
      const oldName = schoolName;

      // 1. localStorage와 state 업데이트
      setSchoolName(newName);
      localStorage.setItem('schoolName', newName);
      setShowSchoolNameModal(false);
      setTempSchoolName('');

      const accessToken = localStorage.getItem('googleAccessToken');

      // 2. Google Drive 폴더 이름 변경 (비동기로 처리, 실패해도 앱은 계속 작동)
      if (accessToken && oldName !== newName) {
        try {
          const result = await renameSchoolFolder(oldName, newName, accessToken);
          console.log('Google Drive 폴더 이름 변경:', result.message);
        } catch (driveError: any) {
          console.error('Google Drive 폴더 이름 변경 실패:', driveError);
        }

        // 3. 모든 사용자의 Google Sheets 업데이트
        try {
          const userSheets = await getAllUserSheets();
          if (userSheets.length > 0) {
            let successCount = 0;
            let failureCount = 0;

            for (const userSheet of userSheets) {
              try {
                await updateSchoolNameInAllTabs(userSheet.sheetId, newName, accessToken);
                successCount++;
              } catch (sheetError) {
                console.error(`시트 업데이트 실패 (userId: ${userSheet.userId}):`, sheetError);
                failureCount++;
              }
            }

            if (successCount > 0 || failureCount > 0) {
              alert(`학교 이름이 변경되었습니다.\n\nGoogle Sheets 업데이트 결과:\n- 성공: ${successCount}개 시트\n- 실패: ${failureCount}개 시트`);
            } else {
              alert('학교 이름이 변경되었습니다.');
            }
          } else {
            alert('학교 이름이 변경되었습니다.\n\n아직 생성된 사용자 시트가 없습니다.');
          }
        } catch (sheetsError: any) {
          console.error('Google Sheets 업데이트 실패:', sheetsError);
          alert(`학교 이름은 변경되었지만, Google Sheets 업데이트에 실패했습니다.\n에러: ${sheetsError.message}`);
        }
      } else if (!accessToken) {
        alert('학교 이름이 변경되었습니다.\n\nGoogle Drive 및 Sheets를 업데이트하려면 먼저 Google에 연결해주세요.');
      } else {
        alert('학교 이름이 변경되었습니다.');
      }
    } catch (error) {
      console.error('학교 이름 변경 실패:', error);
      alert('학교 이름 변경에 실패했습니다.');
    }
  };

  const openSchoolNameModal = () => {
    setTempSchoolName(schoolName);
    setShowSchoolNameModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 학교 이름 설정 모달 */}
      {showSchoolNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">학교 이름 설정</h3>
            <input
              type="text"
              value={tempSchoolName}
              onChange={(e) => setTempSchoolName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 mb-6"
              placeholder="예: OO중학교"
              maxLength={50}
              onKeyPress={(e) => e.key === 'Enter' && handleSchoolNameSave()}
            />
            <div className="flex space-x-3">
              <button
                onClick={handleSchoolNameSave}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setShowSchoolNameModal(false);
                  setTempSchoolName('');
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{schoolName}</h1>
                <button
                  onClick={openSchoolNameModal}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-semibold"
                  title="학교 이름 변경"
                >
                  학교 이름 변경
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {user?.displayName || user?.email} 님 환영합니다
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href="/"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                홈으로
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'quiz'
                ? 'border-b-4 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            퀴즈 관리
          </button>
          <button
            onClick={() => setActiveTab('survey')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'survey'
                ? 'border-b-4 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            설문 관리
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'discussion'
                ? 'border-b-4 border-orange-500 text-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            논의 자료
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('approval')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'approval'
                  ? 'border-b-4 border-purple-500 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              승인 관리
            </button>
          )}
        </div>

        {/* 컨텐츠 영역 */}
        <div className="mt-8">
          {activeTab === 'quiz' && <QuizManager userId={user?.uid} />}
          {activeTab === 'survey' && <SurveyManager userId={user?.uid} />}
          {activeTab === 'discussion' && <DepartmentManager userId={user?.uid} />}
          {activeTab === 'approval' && isAdmin && <ApprovalManager userId={user?.uid} />}
        </div>
      </div>
    </div>
  );
}

// 승인 관리 컴포넌트
function ApprovalManager({ userId }: { userId: string }) {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    try {
      setIsLoading(true);
      const users = await getPendingUsers();
      setPendingUsers(users);
    } catch (error) {
      console.error('승인 대기 목록 불러오기 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (pendingUserId: string, uid: string, email: string, displayName: string | null, photoURL: string | null) => {
    if (!confirm('이 사용자를 승인하시겠습니까?')) {
      return;
    }

    try {
      await approveUser(pendingUserId, uid, email, displayName, photoURL, userId);
      await loadPendingUsers();
      alert('승인되었습니다.');
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인에 실패했습니다.');
    }
  };

  const handleReject = async (pendingUserId: string) => {
    if (!confirm('이 사용자를 거절하시겠습니까?')) {
      return;
    }

    try {
      await rejectUser(pendingUserId);
      await loadPendingUsers();
      alert('거절되었습니다.');
    } catch (error) {
      console.error('거절 실패:', error);
      alert('거절에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">승인 대기 목록</h2>
        <button
          onClick={loadPendingUsers}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
        >
          새로고침
        </button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-lg">목록을 불러오는 중...</p>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">승인 대기 중인 사용자가 없습니다</p>
          </div>
        ) : (
          pendingUsers.map((pendingUser: any) => (
            <div key={pendingUser.id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {pendingUser.photoURL && (
                    <img
                      src={pendingUser.photoURL}
                      alt="프로필"
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {pendingUser.displayName || '이름 없음'}
                    </h3>
                    <p className="text-gray-600">{pendingUser.email}</p>
                    <p className="text-sm text-gray-400">
                      {pendingUser.createdAt?.toLocaleString('ko-KR') || ''}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApprove(
                      pendingUser.id,
                      pendingUser.uid,
                      pendingUser.email,
                      pendingUser.displayName,
                      pendingUser.photoURL
                    )}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleReject(pendingUser.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
                  >
                    거절
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// 퀴즈 관리 컴포넌트
function QuizManager({ userId }: { userId: string }) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase에서 퀴즈 목록 불러오기
  useEffect(() => {
    if (userId) {
      loadQuizzes();
    }
  }, [userId]);

  const loadQuizzes = async () => {
    try {
      setIsLoading(true);
      const quizList = await getQuizzes(userId);
      setQuizzes(quizList);
    } catch (error) {
      console.error('퀴즈 목록 불러오기 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizCreated = (quiz: any) => {
    setQuizzes([...quizzes, quiz]);
    // QR 코드를 표시하기 위해 폼을 닫지 않음
  };

  const handleQuizUpdated = (updatedQuiz: any) => {
    setQuizzes(quizzes.map((q: any) => q.id === updatedQuiz.id ? updatedQuiz : q));
    setEditingQuiz(null);
    setShowCreateForm(false);
  };

  const handleQuizEdit = (quiz: any) => {
    setEditingQuiz(quiz);
    setShowCreateForm(true);
  };

  const handleQuizDelete = async (quizId: string) => {
    if (!confirm('이 퀴즈를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteQuiz(quizId);
      setQuizzes(quizzes.filter(q => q.id !== quizId));
      // 생성/수정 폼이 열려있으면 닫기
      setShowCreateForm(false);
      setEditingQuiz(null);
    } catch (error) {
      console.error('퀴즈 삭제 실패:', error);
      alert('퀴즈 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 새 퀴즈 생성 버튼 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">퀴즈 목록</h2>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            if (showCreateForm) setEditingQuiz(null);
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
        >
          {showCreateForm ? '취소' : '+ 새 퀴즈 만들기'}
        </button>
      </div>

      {/* 퀴즈 생성/수정 폼 */}
      {showCreateForm && (
        <QuizCreateForm
          onClose={() => {
            setShowCreateForm(false);
            setEditingQuiz(null);
          }}
          onCreated={handleQuizCreated}
          onUpdated={handleQuizUpdated}
          userId={userId}
          editingQuiz={editingQuiz}
        />
      )}

      {/* 퀴즈 목록 */}
      {!showCreateForm && (
        <div className="grid gap-4">
          {isLoading ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-lg">퀴즈 목록을 불러오는 중...</p>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">아직 생성된 퀴즈가 없습니다</p>
              <p className="text-gray-400 mt-2">위의 버튼을 클릭하여 첫 퀴즈를 만들어보세요!</p>
            </div>
          ) : (
          quizzes.map((quiz: any) => (
            <QuizCard key={quiz.id} quiz={quiz} onEdit={handleQuizEdit} onDelete={handleQuizDelete} />
          ))
        )}
        </div>
      )}
    </div>
  );
}

// 설문 관리 컴포넌트
function SurveyManager({ userId }: { userId: string }) {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase에서 설문 목록 불러오기
  useEffect(() => {
    if (userId) {
      loadSurveys();
    }
  }, [userId]);

  const loadSurveys = async () => {
    try {
      setIsLoading(true);
      const surveyList = await getSurveys(userId);
      setSurveys(surveyList);
    } catch (error) {
      console.error('설문 목록 불러오기 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSurveyCreated = (survey: any) => {
    setSurveys([...surveys, survey]);
    // QR 코드를 표시하기 위해 폼을 닫지 않음
  };

  const handleSurveyUpdated = (updatedSurvey: any) => {
    setSurveys(surveys.map((s: any) => s.id === updatedSurvey.id ? updatedSurvey : s));
    setEditingSurvey(null);
    setShowCreateForm(false);
  };

  const handleSurveyEdit = (survey: any) => {
    setEditingSurvey(survey);
    setShowCreateForm(true);
  };

  const handleSurveyDelete = async (surveyId: string) => {
    if (!confirm('이 설문을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteSurvey(surveyId);
      setSurveys(surveys.filter(s => s.id !== surveyId));
      // 생성/수정 폼이 열려있으면 닫기
      setShowCreateForm(false);
      setEditingSurvey(null);
    } catch (error) {
      console.error('설문 삭제 실패:', error);
      alert('설문 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 새 설문 생성 버튼 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">설문 목록</h2>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            if (showCreateForm) setEditingSurvey(null);
          }}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-lg"
        >
          {showCreateForm ? '취소' : '+ 새 설문 만들기'}
        </button>
      </div>

      {/* 설문 생성/수정 폼 */}
      {showCreateForm && (
        <SurveyCreateForm
          onClose={() => {
            setShowCreateForm(false);
            setEditingSurvey(null);
          }}
          onCreated={handleSurveyCreated}
          onUpdated={handleSurveyUpdated}
          userId={userId}
          editingSurvey={editingSurvey}
        />
      )}

      {/* 설문 목록 */}
      {!showCreateForm && (
        <div className="grid gap-4">
          {isLoading ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-lg">설문 목록을 불러오는 중...</p>
            </div>
          ) : surveys.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">아직 생성된 설문이 없습니다</p>
              <p className="text-gray-400 mt-2">위의 버튼을 클릭하여 첫 설문을 만들어보세요!</p>
            </div>
          ) : (
            surveys.map((survey: any) => (
              <SurveyCard key={survey.id} survey={survey} onEdit={handleSurveyEdit} onDelete={handleSurveyDelete} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// 퀴즈 생성/수정 폼
function QuizCreateForm({
  onClose,
  onCreated,
  onUpdated,
  userId,
  editingQuiz
}: {
  onClose: () => void;
  onCreated: (quiz: any) => void;
  onUpdated?: (quiz: any) => void;
  userId: string;
  editingQuiz?: any;
}) {
  const isEditMode = !!editingQuiz;
  const [title, setTitle] = useState(editingQuiz?.title || '');
  const [questionIdCounter, setQuestionIdCounter] = useState(editingQuiz?.questions?.length || 1);
  const [questions, setQuestions] = useState(
    editingQuiz?.questions?.map((q: any, idx: number) => ({
      id: idx,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      timeLimit: q.timeLimit,
      imageUrl: q.imageUrl || '',
    })) || [
      {
        id: 0,
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        timeLimit: 10,
        imageUrl: '',
      }
    ]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: questionIdCounter,
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        timeLimit: 10,
        imageUrl: '',
      }
    ]);
    setQuestionIdCounter(questionIdCounter + 1);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_q: any, i: number) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuestions(questions.map((q: any, idx: number) => {
      if (idx === index) {
        return {
          ...q,
          [field]: value
        };
      }
      return q;
    }));
  };

  const updateOption = (qIndex: number, optionIndex: number, value: string) => {
    setQuestions(questions.map((q: any, idx: number) => {
      if (idx === qIndex) {
        return {
          ...q,
          options: q.options.map((opt: any, optIdx: number) =>
            optIdx === optionIndex ? value : opt
          )
        };
      }
      return q;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      // Firebase에 퀴즈 저장/업데이트 (임시 ID 제거)
      const cleanQuestions = questions.map(({ id, ...rest }: any) => rest);

      if (isEditMode && editingQuiz) {
        // 수정 모드
        await updateQuiz(editingQuiz.id, {
          title,
          questions: cleanQuestions,
        });

        const updatedQuiz = {
          ...editingQuiz,
          title,
          questions: cleanQuestions,
        };

        if (onUpdated) {
          onUpdated(updatedQuiz);
        }

        // 성공 메시지 표시
        setShowSuccessMessage(true);

        // 2초 후 폼 닫기
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // 생성 모드
        const quizId = await createQuiz({
          title,
          questions: cleanQuestions,
        }, userId);

        const quiz = {
          id: quizId,
          title,
          questions: cleanQuestions,
          createdAt: new Date()
        };

        onCreated(quiz);

        // 성공 메시지 표시
        setShowSuccessMessage(true);

        // 2초 후 폼 닫기
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error(isEditMode ? '퀴즈 수정 실패:' : '퀴즈 생성 실패:', error);
      alert(isEditMode ? '퀴즈 수정에 실패했습니다. 다시 시도해주세요.' : '퀴즈 생성에 실패했습니다. 다시 시도해주세요.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 animate-slideUp max-h-[80vh] overflow-y-auto relative">
      {/* 성공 메시지 오버레이 */}
      {showSuccessMessage && (
        <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50 rounded-xl">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{isEditMode ? '퀴즈 수정 완료!' : '퀴즈 생성 완료!'}</h3>
            <p className="text-gray-600 mt-2">{title}</p>
          </div>
        </div>
      )}

      <h3 className="text-xl font-bold text-gray-800 mb-4">{isEditMode ? '퀴즈 수정하기' : '새 퀴즈 만들기'}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            퀴즈 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="예: 2024 교육과정 이해도 점검"
            required
          />
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4">질문 목록 ({questions.length}개)</h4>
          </div>

          {questions.map((q: any, qIndex: number) => (
            <div key={q.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-center mb-3">
                <h5 className="font-semibold text-gray-800">질문 {qIndex + 1}</h5>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="text-red-500 hover:text-red-700 text-sm font-semibold"
                  >
                    삭제
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    질문 내용
                  </label>
                  <textarea
                    value={q.question}
                    onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    rows={2}
                    placeholder="질문을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    선택지 (4개)
                  </label>
                  {q.options.map((option: any, optIndex: number) => (
                    <div key={optIndex} className="flex items-center space-x-2 mb-2">
                      <input
                        type="radio"
                        name={`correctAnswer-${q.id}`}
                        checked={q.correctAnswer === optIndex}
                        onChange={() => updateQuestion(qIndex, 'correctAnswer', optIndex)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        placeholder={`선택지 ${optIndex + 1}`}
                        required
                      />
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 mt-1">라디오 버튼을 클릭하여 정답을 선택하세요</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    제한 시간 (초)
                  </label>
                  <input
                    type="number"
                    value={q.timeLimit}
                    onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                    min="5"
                    max="60"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                <ImageUploader
                  key={`image-uploader-${q.id}`}
                  uploaderId={`image-upload-${q.id}`}
                  onImageUploaded={(imageUrl) => updateQuestion(qIndex, 'imageUrl', imageUrl)}
                  currentImageUrl={q.imageUrl}
                />
              </div>
            </div>
          ))}

          {/* 질문 추가 버튼 */}
          <button
            type="button"
            onClick={addQuestion}
            className="w-full py-4 border-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 hover:border-blue-500 transition-all font-bold text-lg flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            질문 추가하기
          </button>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (isEditMode ? '수정 중...' : '생성 중...') : (isEditMode ? '퀴즈 수정' : '퀴즈 생성')}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

// 설문 생성/수정 폼
function SurveyCreateForm({
  onClose,
  onCreated,
  onUpdated,
  userId,
  editingSurvey
}: {
  onClose: () => void;
  onCreated: (survey: any) => void;
  onUpdated?: (survey: any) => void;
  userId: string;
  editingSurvey?: any;
}) {
  const isEditMode = !!editingSurvey;
  const [title, setTitle] = useState(editingSurvey?.title || '');
  const [question, setQuestion] = useState(editingSurvey?.question || '');
  const [type, setType] = useState<'scale' | 'text'>(editingSurvey?.type || 'scale');
  const [timeLimit, setTimeLimit] = useState(editingSurvey?.timeLimit || 60);
  const [imageUrl, setImageUrl] = useState(editingSurvey?.imageUrl || '');
  const [studentResultImageUrl, setStudentResultImageUrl] = useState(editingSurvey?.studentResultImageUrl || '');
  const [parentResultImageUrl, setParentResultImageUrl] = useState(editingSurvey?.parentResultImageUrl || '');

  // 학생 결과 데이터
  const [studentResultData, setStudentResultData] = useState({
    stronglyAgree: editingSurvey?.studentResultData?.stronglyAgree || 0,
    agree: editingSurvey?.studentResultData?.agree || 0,
    neutral: editingSurvey?.studentResultData?.neutral || 0,
    disagree: editingSurvey?.studentResultData?.disagree || 0,
    stronglyDisagree: editingSurvey?.studentResultData?.stronglyDisagree || 0,
  });

  // 학부모 결과 데이터
  const [parentResultData, setParentResultData] = useState({
    stronglyAgree: editingSurvey?.parentResultData?.stronglyAgree || 0,
    agree: editingSurvey?.parentResultData?.agree || 0,
    neutral: editingSurvey?.parentResultData?.neutral || 0,
    disagree: editingSurvey?.parentResultData?.disagree || 0,
    stronglyDisagree: editingSurvey?.parentResultData?.stronglyDisagree || 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      if (isEditMode && editingSurvey) {
        // 수정 모드
        await updateSurvey(editingSurvey.id, {
          title,
          question,
          type,
          timeLimit,
          imageUrl,
          studentResultImageUrl,
          parentResultImageUrl,
          studentResultData,
          parentResultData,
        });

        const updatedSurvey = {
          ...editingSurvey,
          title,
          question,
          type,
          timeLimit,
          imageUrl,
          studentResultImageUrl,
          parentResultImageUrl,
          studentResultData,
          parentResultData,
        };

        if (onUpdated) {
          onUpdated(updatedSurvey);
        }

        // 성공 메시지 표시
        setShowSuccessMessage(true);

        // 2초 후 폼 닫기
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // 생성 모드
        const surveyId = await createSurvey({
          title,
          question,
          type,
          timeLimit,
          imageUrl,
          studentResultImageUrl,
          parentResultImageUrl,
          studentResultData,
          parentResultData,
        }, userId);

        const survey = {
          id: surveyId,
          title,
          question,
          type,
          timeLimit,
          imageUrl,
          studentResultImageUrl,
          parentResultImageUrl,
          studentResultData,
          parentResultData,
          createdAt: new Date()
        };

        onCreated(survey);

        // 성공 메시지 표시
        setShowSuccessMessage(true);

        // 2초 후 폼 닫기
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error(isEditMode ? '설문 수정 실패:' : '설문 생성 실패:', error);
      alert(isEditMode ? '설문 수정에 실패했습니다. 다시 시도해주세요.' : '설문 생성에 실패했습니다. 다시 시도해주세요.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 animate-slideUp relative">
      {/* 성공 메시지 오버레이 */}
      {showSuccessMessage && (
        <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50 rounded-xl">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{isEditMode ? '설문 수정 완료!' : '설문 생성 완료!'}</h3>
            <p className="text-gray-600 mt-2">{title}</p>
          </div>
        </div>
      )}

      <h3 className="text-xl font-bold text-gray-800 mb-4">{isEditMode ? '설문 수정하기' : '새 설문 만들기'}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설문 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            placeholder="예: 내년도 교육과정 방향성"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            질문
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            rows={3}
            placeholder="설문 질문을 입력하세요"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설문 유형
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="type"
                value="scale"
                checked={type === 'scale'}
                onChange={() => setType('scale')}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-gray-900">5점 척도 (적극 찬성 ~ 적극 반대)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="type"
                value="text"
                checked={type === 'text'}
                onChange={() => setType('text')}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-gray-900">서술형</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            제한 시간 (초)
          </label>
          <input
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(parseInt(e.target.value))}
            min="10"
            max="300"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
          />
        </div>

        <ImageUploader
          onImageUploaded={setImageUrl}
          currentImageUrl={imageUrl}
        />

        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">📊 비교 결과 이미지 (선택사항)</h4>
          <p className="text-xs text-gray-500 mb-3">학생/학부모 대상 설문 결과를 미리 업로드하면 교사 설문 결과와 함께 비교할 수 있습니다.</p>

          <div className="space-y-6">
            {/* 학생 결과 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <label className="block text-sm font-semibold text-blue-900 mb-2">
                👦 학생 대상 설문 결과
              </label>
              <ImageUploader
                onImageUploaded={setStudentResultImageUrl}
                currentImageUrl={studentResultImageUrl}
                uploaderId="student-result-upload"
                folderName="설문 이미지"
              />

              <div className="mt-4">
                <p className="text-xs text-gray-600 mb-2">구글폼 결과 데이터 (선택사항, Google Sheets 비교용)</p>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">적극 찬성</label>
                    <input
                      type="number"
                      min="0"
                      value={studentResultData.stronglyAgree}
                      onChange={(e) => setStudentResultData({...studentResultData, stronglyAgree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">찬성</label>
                    <input
                      type="number"
                      min="0"
                      value={studentResultData.agree}
                      onChange={(e) => setStudentResultData({...studentResultData, agree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">보통</label>
                    <input
                      type="number"
                      min="0"
                      value={studentResultData.neutral}
                      onChange={(e) => setStudentResultData({...studentResultData, neutral: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">반대</label>
                    <input
                      type="number"
                      min="0"
                      value={studentResultData.disagree}
                      onChange={(e) => setStudentResultData({...studentResultData, disagree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">적극 반대</label>
                    <input
                      type="number"
                      min="0"
                      value={studentResultData.stronglyDisagree}
                      onChange={(e) => setStudentResultData({...studentResultData, stronglyDisagree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 학부모 결과 */}
            <div className="bg-purple-50 rounded-lg p-4">
              <label className="block text-sm font-semibold text-purple-900 mb-2">
                👨‍👩‍👧 학부모 대상 설문 결과
              </label>
              <ImageUploader
                onImageUploaded={setParentResultImageUrl}
                currentImageUrl={parentResultImageUrl}
                uploaderId="parent-result-upload"
                folderName="설문 이미지"
              />

              <div className="mt-4">
                <p className="text-xs text-gray-600 mb-2">구글폼 결과 데이터 (선택사항, Google Sheets 비교용)</p>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">적극 찬성</label>
                    <input
                      type="number"
                      min="0"
                      value={parentResultData.stronglyAgree}
                      onChange={(e) => setParentResultData({...parentResultData, stronglyAgree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">찬성</label>
                    <input
                      type="number"
                      min="0"
                      value={parentResultData.agree}
                      onChange={(e) => setParentResultData({...parentResultData, agree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">보통</label>
                    <input
                      type="number"
                      min="0"
                      value={parentResultData.neutral}
                      onChange={(e) => setParentResultData({...parentResultData, neutral: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">반대</label>
                    <input
                      type="number"
                      min="0"
                      value={parentResultData.disagree}
                      onChange={(e) => setParentResultData({...parentResultData, disagree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">적극 반대</label>
                    <input
                      type="number"
                      min="0"
                      value={parentResultData.stronglyDisagree}
                      onChange={(e) => setParentResultData({...parentResultData, stronglyDisagree: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (isEditMode ? '수정 중...' : '생성 중...') : (isEditMode ? '설문 수정' : '설문 생성')}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

// 퀴즈 카드 컴포넌트
function QuizCard({ quiz, onEdit, onDelete }: { quiz: any; onEdit: (quiz: any) => void; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    try {
      setIsStarting(true);
      const sessionId = await createQuizSession(quiz.id);
      router.push(`/admin/session/${sessionId}`);
    } catch (error) {
      console.error('세션 생성 실패:', error);
      alert('세션 생성에 실패했습니다.');
      setIsStarting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow">
      <div className="flex justify-between items-start gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-800">{quiz.title}</h3>
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
            <span>❓ {quiz.questions?.length || 0}개 질문</span>
            <span>⏱ 평균 {quiz.questions?.[0]?.timeLimit || 10}초</span>
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold disabled:bg-gray-400"
          >
            {isStarting ? '생성 중...' : '시작하기'}
          </button>
          <button
            onClick={() => onEdit(quiz)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
          >
            수정
          </button>
          <button
            onClick={() => onDelete(quiz.id)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// 설문 카드 컴포넌트
function SurveyCard({ survey, onEdit, onDelete }: { survey: any; onEdit: (survey: any) => void; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    try {
      setIsStarting(true);
      const sessionId = await createSurveySession(survey.id);
      router.push(`/admin/survey-session/${sessionId}`);
    } catch (error) {
      console.error('세션 생성 실패:', error);
      alert('세션 생성에 실패했습니다.');
      setIsStarting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow">
      <div className="flex justify-between items-start gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-800">{survey.title}</h3>
          <p className="text-gray-600 mt-2">{survey.question}</p>
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
            <span>⏱ {survey.timeLimit}초</span>
            <span>📊 {survey.type === 'scale' ? '5점 척도' : '서술형'}</span>
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold disabled:bg-gray-400"
          >
            {isStarting ? '생성 중...' : '시작하기'}
          </button>
          <button
            onClick={() => onEdit(survey)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            수정
          </button>
          <button
            onClick={() => onDelete(survey.id)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// 논의 자료 관리 컴포넌트
function DepartmentManager({ userId }: { userId: string | undefined }) {
  const router = useRouter();
  const [topics, setTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [userSheet, setUserSheet] = useState<any>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  // userId가 없으면 로딩 화면 표시
  if (!userId) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-8 text-center">
          <p className="text-yellow-800 text-lg font-semibold">로그인 정보를 불러오는 중...</p>
          <p className="text-yellow-600 text-sm mt-2">잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  // 논의 및 결정사항 관련 상태
  const [discussionItems, setDiscussionItems] = useState<any[]>([]);
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(false);
  const [newDiscussionItem, setNewDiscussionItem] = useState({
    topic: '',
    gradeOrDept: '',
    process: '',
    decision: ''
  });
  const [sheetExists, setSheetExists] = useState<boolean>(false);
  const [isCheckingSheet, setIsCheckingSheet] = useState<boolean>(false);

  // 각 행의 편집 상태를 저장할 객체 (논의 과정과 결정 사항을 독립적으로 관리)
  const [editingProcess, setEditingProcess] = useState<{[key: string]: boolean}>({});
  const [editingDecision, setEditingDecision] = useState<{[key: string]: boolean}>({});

  // 각 행의 input ref를 저장할 객체
  const processRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const decisionRefs = useRef<{[key: string]: HTMLInputElement | null}>({});

  // 의견 수집 관련 상태
  const [selectedDiscussionItem, setSelectedDiscussionItem] = useState<any>(null);
  const [showOpinionTypeModal, setShowOpinionTypeModal] = useState(false);
  const [showOpinionSessionModal, setShowOpinionSessionModal] = useState(false);
  const [currentOpinionSession, setCurrentOpinionSession] = useState<any>(null);
  const [opinions, setOpinions] = useState<any[]>([]);
  const [isStartingOpinionSession, setIsStartingOpinionSession] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Google API 토큰 만료 시 자동 로그아웃
  const handleTokenExpired = async () => {
    console.log('Google 토큰이 만료되었습니다. 자동 로그아웃합니다.');
    localStorage.removeItem('googleAccessToken');
    await signOut(auth);
    alert('Google 인증이 만료되었습니다.\n\n다시 로그인해주세요.');
    router.push('/login');
  };

  useEffect(() => {
    if (userId) {
      loadTopics();
      loadUserSheet();
    }
  }, [userId]);

  useEffect(() => {
    if (userSheet?.sheetId) {
      checkSheetExists();
    } else {
      setSheetExists(false);
    }
  }, [userSheet]);

  useEffect(() => {
    if (sheetExists) {
      loadDiscussionItems();
    }
  }, [sheetExists]);

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      const topicList = await getDepartments(userId);
      setTopics(topicList);
    } catch (error) {
      console.error('업무 목록 불러오기 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserSheet = async () => {
    try {
      const sheet = await getUserSheet(userId);
      if (sheet) {
        setUserSheet(sheet);
      } else {
        // Firestore에 없으면 Google Drive에서 검색
        await searchSheetInDrive();
      }
    } catch (error) {
      console.error('사용자 시트 정보 불러오기 실패:', error);
    }
  };

  const searchSheetInDrive = async () => {
    try {
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) return;

      // Google Drive에서 고정된 시트 이름으로 검색
      const searchQuery = encodeURIComponent(`name='교육과정 워크숍 논의 자료' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${searchQuery}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.status === 401) {
        // 토큰 만료 시 자동 로그아웃
        await handleTokenExpired();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.files && data.files.length > 0) {
          const foundSheet = data.files[0];
          console.log('Google Drive에서 기존 시트 발견:', foundSheet);

          // Firestore에 자동 저장
          await saveUserSheet({
            userId,
            sheetId: foundSheet.id,
            sheetUrl: foundSheet.webViewLink || `https://docs.google.com/spreadsheets/d/${foundSheet.id}/edit`,
            webAppUrl: null,
            templateId: process.env.NEXT_PUBLIC_DISCUSSION_TEMPLATE_ID || '1Fe5kFAqGN8A-cd8iVXlmVuPgD0ZmCTin9yrFlOFP69s',
          });

          // 오래된 시트 히스토리 정리 (Firestore 용량 절약)
          await cleanOldUserSheetHistory(userId);

          // UI 업데이트
          setUserSheet({
            userId,
            sheetId: foundSheet.id,
            sheetUrl: foundSheet.webViewLink || `https://docs.google.com/spreadsheets/d/${foundSheet.id}/edit`,
            webAppUrl: null,
            templateId: process.env.NEXT_PUBLIC_DISCUSSION_TEMPLATE_ID || '1Fe5kFAqGN8A-cd8iVXlmVuPgD0ZmCTin9yrFlOFP69s',
            createdAt: new Date(foundSheet.createdTime),
          });

          console.log('기존 시트 자동 연결 완료');
        }
      }
    } catch (error) {
      console.error('Google Drive 검색 실패:', error);
    }
  };

  const checkSheetExists = async () => {
    if (!userSheet?.sheetId) {
      setSheetExists(false);
      return;
    }

    try {
      setIsCheckingSheet(true);
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) {
        setSheetExists(false);
        return;
      }

      // Google Drive API로 파일 존재 여부 확인
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${userSheet.sheetId}?fields=id,name,trashed`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.status === 401) {
        // 토큰 만료 시 자동 로그아웃
        await handleTokenExpired();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        // 파일이 존재하고 휴지통에 없는 경우만 true
        setSheetExists(!data.trashed);
      } else {
        setSheetExists(false);
      }
    } catch (error) {
      console.error('시트 존재 여부 확인 실패:', error);
      setSheetExists(false);
    } finally {
      setIsCheckingSheet(false);
    }
  };

  const handleCreateUserSheet = async () => {
    const templateId = process.env.NEXT_PUBLIC_DISCUSSION_TEMPLATE_ID || '1Fe5kFAqGN8A-cd8iVXlmVuPgD0ZmCTin9yrFlOFP69s';
    const schoolName = localStorage.getItem('schoolName') || '2025학년도 경남초등학교 교육과정 워크숍';

    console.log('템플릿 ID:', templateId);
    console.log('환경 변수:', process.env.NEXT_PUBLIC_DISCUSSION_TEMPLATE_ID);

    if (!confirm('내 전용 논의 자료 시트를 생성하시겠습니까?\n\n템플릿을 복사하여 새 시트를 만듭니다.')) {
      return;
    }

    try {
      setIsCreatingSheet(true);

      // 1. Google 액세스 토큰 확인
      const accessToken = localStorage.getItem('googleAccessToken');

      if (!accessToken) {
        throw new Error('Google 액세스 토큰이 없습니다. 다시 로그인해주세요.');
      }

      // 2. 학교 폴더 찾기 또는 생성
      const schoolFolderId = await findOrCreateFolder(schoolName, accessToken);

      // 3. 템플릿 시트 복사 (학교 폴더에 저장)
      const sheetName = '교육과정 워크숍 논의 자료';

      const copyResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: sheetName,
            parents: [schoolFolderId],
          }),
        }
      );

      if (!copyResponse.ok) {
        // 401 에러면 토큰 만료 - 자동 로그아웃
        if (copyResponse.status === 401) {
          await handleTokenExpired();
          return;
        }

        const error = await copyResponse.json();
        throw new Error(`시트 복사 실패: ${JSON.stringify(error)}`);
      }

      const copyData = await copyResponse.json();

      const newSheetId = copyData.id;
      const newSheetUrl = copyData.webViewLink || `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

      console.log('시트 복사 완료:', newSheetId);

      // 4. 관리자에게 편집 권한 부여
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'tmdsh2000@gmail.com';
      try {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${newSheetId}/permissions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'writer',
              type: 'user',
              emailAddress: adminEmail,
            }),
          }
        );
        console.log('관리자 편집 권한 부여 완료');
      } catch (permError) {
        console.error('관리자 권한 부여 실패:', permError);
        // 권한 부여 실패는 치명적이지 않으므로 계속 진행
      }

      // 4-1. 링크를 아는 모든 사용자에게 편집 권한 부여 (선생님들 공유용)
      try {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${newSheetId}/permissions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'writer',
              type: 'anyone',
            }),
          }
        );
        console.log('링크 공유 편집 권한 부여 완료');
      } catch (permError) {
        console.error('링크 공유 권한 부여 실패:', permError);
        // 권한 부여 실패는 치명적이지 않으므로 계속 진행
      }

      // 5. 사용자 시트 초기화 (탭 구조 조정 및 초기 데이터 설정)
      await initializeUserSheet(newSheetId, topics, schoolName, accessToken);

      // 6. Firestore에 저장
      await saveUserSheet({
        userId,
        sheetId: newSheetId,
        sheetUrl: newSheetUrl,
        webAppUrl: null,
        templateId,
      });

      // 오래된 시트 히스토리 정리 (Firestore 용량 절약)
      await cleanOldUserSheetHistory(userId);

      // 7. 즉시 UI 업데이트 (실시간 반영)
      setUserSheet({
        userId,
        sheetId: newSheetId,
        sheetUrl: newSheetUrl,
        webAppUrl: null,
        templateId,
        createdAt: new Date(),
      });

      // 시트가 생성되었으므로 존재 여부를 true로 설정
      setSheetExists(true);

      alert('논의 자료 시트가 생성되었습니다!\n\n시트를 열어서 확인하세요.');
    } catch (error: any) {
      console.error('시트 생성 실패:', error);
      let errorMessage = '시트 생성에 실패했습니다.';

      if (error.message?.includes('popup')) {
        errorMessage = '팝업이 차단되었습니다.\n\n브라우저에서 팝업을 허용하고 다시 시도해주세요.';
      } else if (error.message?.includes('cancelled')) {
        errorMessage = 'Google 인증이 취소되었습니다.';
      } else if (error.message) {
        errorMessage = `시트 생성에 실패했습니다.\n\n에러: ${error.message}`;
      }

      alert(errorMessage);
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleCreate = async () => {
    if (!newTopicName.trim()) {
      alert('업무 이름을 입력해주세요.');
      return;
    }

    try {
      const topicName = newTopicName.trim();
      const order = topics.length > 0 ? Math.max(...topics.map(t => t.order)) + 1 : 0;

      // 1. Firestore에 부서 추가
      await createDepartment({ name: topicName, order }, userId);

      // 2. 부서 목록 새로고침
      await loadTopics();
      setNewTopicName('');
      setShowCreateForm(false);

      alert('부서가 추가되었습니다.\n\n새로 시트를 생성하는 사용자에게 자동으로 이 부서 탭이 추가됩니다.');
    } catch (error) {
      console.error('부서 생성 실패:', error);
      alert('부서 생성에 실패했습니다.');
    }
  };

  const handleUpdate = async (topicId: string, newName: string) => {
    if (!newName.trim()) {
      alert('업무 이름을 입력해주세요.');
      return;
    }

    try {
      const oldName = editingTopic?.name;
      const trimmedNewName = newName.trim();

      if (oldName === trimmedNewName) {
        setEditingTopic(null);
        return;
      }

      // 1. Firestore에서 부서 이름 변경
      await updateDepartment(topicId, { name: trimmedNewName });

      // 2. 부서 목록 새로고침
      await loadTopics();
      setEditingTopic(null);

      alert('부서 이름이 변경되었습니다.');
    } catch (error) {
      console.error('부서 수정 실패:', error);
      alert('부서 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (topicId: string) => {
    const topicToDelete = topics.find(t => t.id === topicId);
    if (!topicToDelete) return;

    if (!confirm(`'${topicToDelete.name}' 부서를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // Firestore에서 부서 삭제
      await deleteDepartment(topicId);
      await loadTopics();

      alert('부서가 삭제되었습니다.');
    } catch (error) {
      console.error('부서 삭제 실패:', error);
      alert('부서 삭제에 실패했습니다.');
    }
  };

  const handleMoveUp = async (topic: any, index: number) => {
    if (index === 0) return;

    try {
      const prevTopic = topics[index - 1];
      await updateDepartment(topic.id, { order: prevTopic.order });
      await updateDepartment(prevTopic.id, { order: topic.order });
      await loadTopics();
    } catch (error) {
      console.error('순서 변경 실패:', error);
      alert('순서 변경에 실패했습니다.');
    }
  };

  const handleMoveDown = async (topic: any, index: number) => {
    if (index === topics.length - 1) return;

    try {
      const nextTopic = topics[index + 1];
      await updateDepartment(topic.id, { order: nextTopic.order });
      await updateDepartment(nextTopic.id, { order: topic.order });
      await loadTopics();
    } catch (error) {
      console.error('순서 변경 실패:', error);
      alert('순서 변경에 실패했습니다.');
    }
  };

  // 논의 및 결정사항 관련 함수들
  const loadDiscussionItems = async () => {
    if (!userSheet?.sheetId) {
      setDiscussionItems([]);
      return;
    }

    try {
      setIsLoadingDiscussions(true);
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) {
        throw new Error('Google 액세스 토큰이 없습니다.');
      }

      const items = await getDiscussionItems(userSheet.sheetId, accessToken);
      setDiscussionItems(items);
    } catch (error) {
      console.error('논의 항목 로드 실패:', error);
      alert('논의 항목을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingDiscussions(false);
    }
  };

  const handleAddDiscussionItem = async () => {
    if (!userSheet?.sheetId) {
      alert('먼저 시트를 생성해주세요.');
      return;
    }

    if (!newDiscussionItem.topic.trim()) {
      alert('논의할 점을 입력해주세요.');
      return;
    }

    if (!newDiscussionItem.gradeOrDept.trim()) {
      alert('학년/업무를 입력해주세요.');
      return;
    }

    try {
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) {
        throw new Error('Google 액세스 토큰이 없습니다.');
      }

      await addDiscussionItem(userSheet.sheetId, {
        topic: newDiscussionItem.topic,
        gradeOrDept: newDiscussionItem.gradeOrDept
      }, accessToken);

      // 폼 초기화
      setNewDiscussionItem({
        topic: '',
        gradeOrDept: '',
        process: '',
        decision: ''
      });

      // 목록 새로고침
      await loadDiscussionItems();
      alert('논의 항목이 추가되었습니다.');
    } catch (error) {
      console.error('논의 항목 추가 실패:', error);
      alert('논의 항목 추가에 실패했습니다.');
    }
  };

  const handleUpdateDiscussionItem = async (row: number, item: any) => {
    if (!userSheet?.sheetId) return;

    try {
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) {
        throw new Error('Google 액세스 토큰이 없습니다.');
      }

      await updateDiscussionItem(userSheet.sheetId, row, item, accessToken);

      // 목록 새로고침
      await loadDiscussionItems();
      alert('저장되었습니다.');
    } catch (error) {
      console.error('논의 항목 수정 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDeleteDiscussionItem = async (row: number, topic: string) => {
    if (!userSheet?.sheetId) return;

    if (!confirm(`'${topic}' 항목을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) {
        throw new Error('Google 액세스 토큰이 없습니다.');
      }

      await deleteDiscussionItem(userSheet.sheetId, row, accessToken);
      await loadDiscussionItems();
      alert('논의 항목이 삭제되었습니다.');
    } catch (error) {
      console.error('논의 항목 삭제 실패:', error);
      alert('논의 항목 삭제에 실패했습니다.');
    }
  };

  // 의견 수집 시작
  const handleStartOpinionSession = async (type: 'free' | 'scale') => {
    console.log('=== 의견 수집 시작 ===');
    console.log('userId:', userId);
    console.log('selectedDiscussionItem:', selectedDiscussionItem);
    console.log('userSheet:', userSheet);
    console.log('type:', type);

    // userId 확인
    if (!userId) {
      console.error('❌ userId가 없습니다');
      alert('로그인 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    if (!selectedDiscussionItem) {
      console.error('❌ selectedDiscussionItem이 없습니다');
      alert('논의 항목을 선택해주세요.');
      return;
    }

    if (!userSheet?.sheetId) {
      console.error('❌ userSheet.sheetId가 없습니다');
      alert('시트 정보가 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    try {
      setIsStartingOpinionSession(true);
      console.log('✅ 검증 통과, createOpinionSession 호출 중...');

      const sessionData = {
        discussionItemId: selectedDiscussionItem.id,
        discussionTopic: selectedDiscussionItem.topic,
        discussionRow: selectedDiscussionItem.row,
        type,
        sheetId: userSheet.sheetId,
      };
      console.log('세션 데이터:', sessionData);

      const sessionId = await createOpinionSession(sessionData, userId);
      console.log('✅ 세션 생성 성공! sessionId:', sessionId);

      setCurrentOpinionSession({ id: sessionId, type });
      setShowOpinionTypeModal(false);
      setShowOpinionSessionModal(true);

      // 실시간 의견 구독 시작
      console.log('의견 구독 시작...');
      const unsubscribe = subscribeToOpinions(sessionId, (newOpinions) => {
        console.log('새 의견 수신:', newOpinions.length, '개');
        setOpinions(newOpinions);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ 의견 수집 세션 생성 실패:', error);
      console.error('에러 상세:', error);

      // 에러 메시지를 더 자세히 표시
      let errorMessage = '의견 수집을 시작할 수 없습니다.';
      if (error instanceof Error) {
        errorMessage += '\n\n에러: ' + error.message;
        if (error.stack) {
          console.error('스택:', error.stack);
        }
      }
      alert(errorMessage);
    } finally {
      setIsStartingOpinionSession(false);
    }
  };

  // 의견 수집 종료
  const handleEndOpinionSession = async () => {
    if (!currentOpinionSession || !userSheet?.sheetId) return;

    if (!confirm('의견 수집을 종료하시겠습니까?')) {
      return;
    }

    try {
      await updateOpinionSessionStatus(currentOpinionSession.id, 'closed');

      // 결과를 논의 과정에 추가
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) {
        throw new Error('Google 액세스 토큰이 없습니다.');
      }

      let resultText = '';
      if (currentOpinionSession.type === 'free') {
        // 자유 의견은 모든 의견을 나열
        resultText = opinions.map((op, idx) => `${idx + 1}. ${op.content}`).join('\n');
      } else {
        // 찬반형은 통계 요약
        const counts = { '+2': 0, '+1': 0, '0': 0, '-1': 0, '-2': 0 };
        opinions.forEach((op) => {
          const key = op.value > 0 ? `+${op.value}` : String(op.value);
          counts[key as keyof typeof counts]++;
        });
        const total = opinions.length;
        const average = total > 0 ? (opinions.reduce((sum, op) => sum + op.value, 0) / total).toFixed(2) : '0';
        resultText = `총 ${total}명 참여\n적극 찬성: ${counts['+2']}명, 찬성: ${counts['+1']}명, 보통: ${counts['0']}명, 반대: ${counts['-1']}명, 적극 반대: ${counts['-2']}명\n평균: ${average}`;
      }

      // 현재 논의 과정에 결과 추가
      const currentProcess = selectedDiscussionItem.process || '';
      const newProcess = currentProcess + (currentProcess ? '\n\n' : '') + `[의견 수집 결과]\n${resultText}`;

      await updateDiscussionItem(
        userSheet.sheetId,
        selectedDiscussionItem.row,
        { process: newProcess, decision: selectedDiscussionItem.decision || '' },
        accessToken
      );

      // Firestore 용량 절약을 위해 세션과 의견 데이터 삭제
      // (결과는 이미 Google Sheets에 저장됨)
      await deleteOpinionSession(currentOpinionSession.id);
      console.log('Firestore 의견 데이터 정리 완료');

      alert('의견 수집이 종료되었습니다. 결과가 논의 과정에 추가되었습니다.');
      setShowOpinionSessionModal(false);
      setCurrentOpinionSession(null);
      setOpinions([]);
      await loadDiscussionItems();
    } catch (error) {
      console.error('의견 수집 종료 실패:', error);
      alert('의견 수집 종료에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">논의 자료 관리</h2>
            <button
              onClick={() => setShowDepartmentModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md text-sm"
            >
              부서 관리
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            워크숍에서 논의할 주제를 관리합니다. 부서는 "부서 관리" 버튼에서 설정할 수 있습니다.
          </p>
          {userSheet && sheetExists && (
            <div className="mt-2">
              <a
                href={userSheet.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                📊 최근 생성한 시트 열기
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(userSheet.sheetUrl).then(() => {
                    alert('시트 공유 링크가 클립보드에 복사되었습니다!');
                  }).catch(() => {
                    alert('복사 실패. 링크를 수동으로 복사해주세요: ' + userSheet.sheetUrl);
                  });
                }}
                className="ml-2 text-sm text-green-600 hover:text-green-800 underline"
              >
                📋 링크 복사
              </button>
              <span className="text-xs text-gray-500 ml-2">
                ({new Date(userSheet.createdAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })} 생성)
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleCreateUserSheet}
          disabled={isCreatingSheet}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isCreatingSheet ? '생성 중...' : '📋 새 시트 생성'}
        </button>
      </div>

      {/* 부서 관리 모달 */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDepartmentModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-800">부서 관리</h3>
              <button
                onClick={() => setShowDepartmentModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 부서 추가 폼 */}
              <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">새 부서 추가</h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="부서 이름 (예: 교육과정, 생활지도, 방과후)"
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    maxLength={30}
                  />
                  <button
                    onClick={handleCreate}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 부서 목록 */}
              <div className="space-y-4">
                {isLoading ? (
                  <div className="bg-white rounded-xl p-12 text-center">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 text-lg">목록을 불러오는 중...</p>
                  </div>
                ) : topics.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center border-2 border-gray-200">
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg">등록된 부서가 없습니다</p>
                    <p className="text-gray-400 text-sm mt-2">위의 폼에서 부서를 추가하세요</p>
                  </div>
                ) : (
                  topics.map((topic, index) => (
                    <div key={topic.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow border-2 border-gray-100">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleMoveUp(topic, index)}
                              disabled={index === 0}
                              className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 transition-colors border border-blue-300"
                              title="위로 이동"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveDown(topic, index)}
                              disabled={index === topics.length - 1}
                              className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 transition-colors border border-blue-300"
                              title="아래로 이동"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex-1">
                            {editingTopic?.id === topic.id ? (
                              <input
                                type="text"
                                defaultValue={topic.name}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const newName = (e.target as HTMLInputElement).value;
                                    handleUpdate(topic.id, newName);
                                  }
                                }}
                                onBlur={(e) => handleUpdate(topic.id, e.target.value)}
                                autoFocus
                                className="text-xl font-bold text-gray-800 border-2 border-blue-500 rounded px-3 py-1 w-full"
                                maxLength={30}
                              />
                            ) : (
                              <div className="text-xl font-bold text-gray-800">{topic.name}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {editingTopic?.id === topic.id ? (
                            <button
                              onClick={() => setEditingTopic(null)}
                              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                              취소
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingTopic(topic)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(topic.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 안내 메시지 */}
              {topics.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                  <h4 className="font-bold text-blue-900 mb-2">📌 안내</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 부서 순서는 위/아래 화살표로 조정할 수 있습니다.</li>
                    <li>• 각 부서는 Google Sheets에서 별도 시트로 관리됩니다.</li>
                    <li>• 새로 시트를 생성하는 사용자에게 자동으로 부서 탭이 추가됩니다.</li>
                  </ul>
                </div>
              )}

              {/* 완료 버튼 */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDepartmentModal(false)}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md"
                >
                  완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 논의 및 결정사항 테이블 */}
      {!sheetExists ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-md">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <p className="text-gray-600 text-lg font-semibold mb-2">시트를 생성해주세요</p>
          <div className="text-gray-500 text-sm space-y-1">
            <p>1. 먼저 <span className="font-semibold text-blue-600">"부서 관리"</span> 버튼을 눌러 부서를 설정하세요</p>
            <p>2. 그 다음 <span className="font-semibold text-green-600">"📋 새 시트 생성"</span> 버튼을 눌러 시트를 만드세요</p>
          </div>
          {isCheckingSheet && (
            <p className="text-gray-400 text-xs mt-4">시트 확인 중...</p>
          )}
        </div>
      ) : (
        <>
          {/* 논의 항목 목록 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">논의할 점</th>
                    <th className="px-6 py-4 text-left font-semibold">학년/업무</th>
                    <th className="px-6 py-4 text-left font-semibold">논의 과정</th>
                    <th className="px-6 py-4 text-left font-semibold">결정 사항</th>
                    <th className="px-6 py-4 text-center font-semibold w-32">의견 수집</th>
                    <th className="px-6 py-4 text-center font-semibold w-32">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingDiscussions ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
                          <p className="text-gray-500">논의 항목을 불러오는 중...</p>
                        </div>
                      </td>
                    </tr>
                  ) : discussionItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <p className="text-gray-500 text-lg">등록된 논의 항목이 없습니다</p>
                        <p className="text-gray-400 text-sm mt-2">Google Sheets의 각 학년/부서 시트 D5 셀에 논의할 점을 입력하세요</p>
                      </td>
                    </tr>
                  ) : (
                    discussionItems.map((item, index) => {
                      // 각 필드별로 독립적으로 편집 모드 확인
                      const isProcessEmpty = !item.process;
                      const isDecisionEmpty = !item.decision;
                      const isEditingProcess = editingProcess[item.id] !== undefined ? editingProcess[item.id] : isProcessEmpty;
                      const isEditingDecision = editingDecision[item.id] !== undefined ? editingDecision[item.id] : isDecisionEmpty;

                      return (
                        <tr
                          key={item.id}
                          className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-green-50 transition-colors border-b border-gray-200`}
                        >
                          <td className="px-6 py-4 min-w-[200px]">
                            <div className="text-gray-900 font-medium">{item.topic}</div>
                          </td>
                          <td className="px-6 py-4 min-w-[120px]">
                            <div className="text-gray-700">{item.gradeOrDept}</div>
                          </td>
                          <td className="px-6 py-4 min-w-[250px]">
                            <div className="flex gap-2 items-center">
                              {isEditingProcess ? (
                                <>
                                  <input
                                    type="text"
                                    defaultValue={item.process}
                                    ref={(input) => {
                                      processRefs.current[item.id] = input;
                                    }}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder="논의 과정을 입력하세요"
                                  />
                                  <button
                                    onClick={() => {
                                      const input = processRefs.current[item.id];
                                      if (input) {
                                        handleUpdateDiscussionItem(item.row, {
                                          process: input.value || ''
                                        });
                                        // 편집 모드 종료
                                        const newEditing = { ...editingProcess };
                                        delete newEditing[item.id];
                                        setEditingProcess(newEditing);
                                      }
                                    }}
                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm whitespace-nowrap"
                                  >
                                    저장
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="flex-1 text-gray-900">{item.process || '-'}</div>
                                  <button
                                    onClick={() => setEditingProcess({ ...editingProcess, [item.id]: true })}
                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
                                  >
                                    수정
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[250px]">
                            <div className="flex gap-2 items-center">
                              {isEditingDecision ? (
                                <>
                                  <input
                                    type="text"
                                    defaultValue={item.decision}
                                    ref={(input) => {
                                      decisionRefs.current[item.id] = input;
                                    }}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder="결정 사항을 입력하세요"
                                  />
                                  <button
                                    onClick={() => {
                                      const input = decisionRefs.current[item.id];
                                      if (input) {
                                        handleUpdateDiscussionItem(item.row, {
                                          decision: input.value || ''
                                        });
                                        // 편집 모드 종료
                                        const newEditing = { ...editingDecision };
                                        delete newEditing[item.id];
                                        setEditingDecision(newEditing);
                                      }
                                    }}
                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm whitespace-nowrap"
                                  >
                                    저장
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="flex-1 text-gray-900">{item.decision || '-'}</div>
                                  <button
                                    onClick={() => setEditingDecision({ ...editingDecision, [item.id]: true })}
                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
                                  >
                                    수정
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[120px]">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setSelectedDiscussionItem(item);
                                  setShowOpinionTypeModal(true);
                                }}
                                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm whitespace-nowrap"
                              >
                                의견 수집
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[100px]">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleDeleteDiscussionItem(item.row, item.topic)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm whitespace-nowrap"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 새 논의 항목 추가 폼 */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 shadow-md border-2 border-green-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">새 논의 항목 추가</h3>
            <p className="text-sm text-gray-600 mb-4">
              Google Sheets의 학년/부서 시트에 기록되지 않은 논의 항목을 추가할 수 있습니다.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={newDiscussionItem.topic}
                onChange={(e) => setNewDiscussionItem({ ...newDiscussionItem, topic: e.target.value })}
                placeholder="논의할 점"
                className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDiscussionItem.gradeOrDept}
                  onChange={(e) => setNewDiscussionItem({ ...newDiscussionItem, gradeOrDept: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddDiscussionItem()}
                  placeholder="학년/업무"
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                />
                <button
                  onClick={handleAddDiscussionItem}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  추가
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              논의 과정과 결정 사항은 추가 후 "수정" 버튼을 눌러 입력하세요.
            </p>
          </div>

          {/* 안내 메시지 */}
          {discussionItems.length > 0 && (
            <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
              <h4 className="font-bold text-green-900 mb-2">📌 안내</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• 모든 변경사항은 Google Sheets에 즉시 반영됩니다.</li>
                <li>• 삭제된 항목은 복구할 수 없으니 주의하세요.</li>
                <li>• Google Sheets를 직접 열어서 편집할 수도 있습니다.</li>
              </ul>
            </div>
          )}
        </>
      )}

      {/* 의견 유형 선택 모달 */}
      {showOpinionTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">의견 수집 유형 선택</h3>
            <p className="text-gray-600 mb-6">어떤 방식으로 의견을 수집하시겠습니까?</p>

            {isStartingOpinionSession && (
              <div className="mb-4 text-center">
                <div className="inline-flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-gray-600">의견 수집 세션 시작 중...</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleStartOpinionSession('free')}
                disabled={isStartingOpinionSession}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isStartingOpinionSession ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    처리 중...
                  </>
                ) : (
                  '자유 의견 제출'
                )}
              </button>
              <button
                onClick={() => handleStartOpinionSession('scale')}
                disabled={isStartingOpinionSession}
                className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isStartingOpinionSession ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    처리 중...
                  </>
                ) : (
                  '찬반형 선택'
                )}
              </button>
              <button
                onClick={() => setShowOpinionTypeModal(false)}
                disabled={isStartingOpinionSession}
                className="w-full bg-gray-400 text-white py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 의견 수집 세션 모달 */}
      {showOpinionSessionModal && currentOpinionSession && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* 헤더 - 제목과 QR 코드 */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">의견 수집 진행 중</h3>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <p className="text-sm text-blue-700 mb-1">논의할 점</p>
                    <p className="text-blue-900 font-bold text-lg">{selectedDiscussionItem?.topic}</p>
                  </div>
                </div>

                {/* 작은 QR 코드 (오른쪽 상단) */}
                <div
                  onClick={() => setShowQRModal(true)}
                  className="ml-6 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  title="클릭하여 QR 코드 확대"
                >
                  <div className="bg-white p-3 rounded-lg shadow-md border-2 border-blue-200">
                    <QRCodeSVG
                      value={`${window.location.origin}/participate/active?uid=${userId}`}
                      size={100}
                    />
                    <p className="text-xs text-center text-gray-600 mt-2">클릭하여 확대</p>
                  </div>
                </div>
              </div>

              {/* 실시간 결과 (크게 표시) */}
              <div className="mb-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4">실시간 결과 ({opinions.length}명 참여)</h4>
                {currentOpinionSession.type === 'free' ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {opinions.length === 0 ? (
                      <p className="text-gray-500 text-center py-8 text-lg">아직 제출된 의견이 없습니다.</p>
                    ) : (
                      opinions.map((op, idx) => (
                        <div key={idx} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                          <p className="text-gray-800 text-base">{op.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const counts = { '+2': 0, '+1': 0, '0': 0, '-1': 0, '-2': 0 };
                      opinions.forEach((op) => {
                        const key = op.value > 0 ? `+${op.value}` : String(op.value);
                        counts[key as keyof typeof counts]++;
                      });
                      return (
                        <>
                          <div className="flex justify-between items-center bg-green-100 p-4 rounded-lg">
                            <span className="text-green-900 font-semibold text-lg">적극 찬성 (+2)</span>
                            <span className="font-bold text-green-900 text-xl">{counts['+2']}명</span>
                          </div>
                          <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg">
                            <span className="text-green-800 font-semibold text-lg">찬성 (+1)</span>
                            <span className="font-bold text-green-800 text-xl">{counts['+1']}명</span>
                          </div>
                          <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                            <span className="text-gray-900 font-semibold text-lg">보통 (0)</span>
                            <span className="font-bold text-gray-900 text-xl">{counts['0']}명</span>
                          </div>
                          <div className="flex justify-between items-center bg-red-50 p-4 rounded-lg">
                            <span className="text-red-800 font-semibold text-lg">반대 (-1)</span>
                            <span className="font-bold text-red-800 text-xl">{counts['-1']}명</span>
                          </div>
                          <div className="flex justify-between items-center bg-red-100 p-4 rounded-lg">
                            <span className="text-red-900 font-semibold text-lg">적극 반대 (-2)</span>
                            <span className="font-bold text-red-900 text-xl">{counts['-2']}명</span>
                          </div>
                          {opinions.length > 0 && (
                            <div className="flex justify-between items-center bg-blue-100 p-4 rounded-lg mt-4">
                              <span className="font-bold text-blue-900 text-lg">평균</span>
                              <span className="font-bold text-blue-900 text-2xl">
                                {(opinions.reduce((sum, op) => sum + op.value, 0) / opinions.length).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* 하단 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (confirm('의견 수집을 취소하시겠습니까?\n\n현재까지 수집된 의견은 저장되지 않습니다.')) {
                      updateOpinionSessionStatus(currentOpinionSession.id, 'closed');
                      deleteOpinionSession(currentOpinionSession.id);
                      setShowOpinionSessionModal(false);
                      setCurrentOpinionSession(null);
                      setOpinions([]);
                    }
                  }}
                  className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors font-semibold"
                >
                  취소
                </button>
                <button
                  onClick={handleEndOpinionSession}
                  className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  의견 수집 종료
                </button>
              </div>
            </div>
          </div>

          {/* QR 코드 확대 모달 */}
          {showQRModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]"
              onClick={() => setShowQRModal(false)}
            >
              <div
                className="bg-white rounded-3xl p-8 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">참여자용 QR 코드</h3>
                <p className="text-sm text-blue-600 mb-6 text-center">모든 논의 사항에서 동일한 QR 코드를 사용합니다</p>

                <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                  <div className="inline-block p-4 bg-white rounded-lg shadow-md mx-auto">
                    <QRCodeSVG
                      value={`${window.location.origin}/participate/active?uid=${userId}`}
                      size={280}
                      level="H"
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-500 break-all text-center mb-6">
                  {`${window.location.origin}/participate/active?uid=${userId}`}
                </p>

                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
