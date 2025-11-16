'use client';

import { useState, useEffect } from 'react';
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
  createDiscussionTopic,
  getDiscussionTopics,
  updateDiscussionTopic,
  deleteDiscussionTopic,
  getAllUserSheets,
  getUserSheet,
  saveUserSheet
} from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import ImageUploader from '@/components/ImageUploader';
import { renameSchoolFolder } from '@/lib/googleDrive';
import {
  updateSchoolNameInAllTabs,
  addSheetTab,
  deleteSheetTab,
  renameSheetTab,
  setupSheetTabData,
  getSheetTabs,
  initializeUserSheet
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
          {activeTab === 'discussion' && <DiscussionManager userId={user?.uid} />}
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

// 논의 자료 (업무) 관리 컴포넌트
function DiscussionManager({ userId }: { userId: string }) {
  const [topics, setTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [userSheet, setUserSheet] = useState<any>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  useEffect(() => {
    if (userId) {
      loadTopics();
      loadUserSheet();
    }
  }, [userId]);

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      const topicList = await getDiscussionTopics(userId);
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
      setUserSheet(sheet);
    } catch (error) {
      console.error('사용자 시트 정보 불러오기 실패:', error);
    }
  };

  const handleCreateUserSheet = async () => {
    const templateId = process.env.NEXT_PUBLIC_DISCUSSION_TEMPLATE_ID || '1Fe5kFAqGN8A-cd8iVXlmVuPgD0ZmCTin9yrFlOFP69s';
    const schoolName = localStorage.getItem('schoolName') || '2025학년도 경남초등학교 교육과정 워크숍';

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

      // 2. 템플릿 시트 복사
      const userEmail = auth.currentUser?.email || '';
      const sheetName = `${schoolName.replace('2025학년도 ', '')} - ${userEmail}`;

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
          }),
        }
      );

      if (!copyResponse.ok) {
        const error = await copyResponse.json();

        // 401 에러면 토큰 만료
        if (copyResponse.status === 401) {
          throw new Error('Google 인증이 만료되었습니다. 다시 로그인해주세요.');
        }

        throw new Error(`시트 복사 실패: ${JSON.stringify(error)}`);
      }

      const copyData = await copyResponse.json();

      const newSheetId = copyData.id;
      const newSheetUrl = copyData.webViewLink || `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

      console.log('시트 복사 완료:', newSheetId);

      // 3. 사용자 시트 초기화 (탭 구조 조정 및 초기 데이터 설정)
      await initializeUserSheet(newSheetId, topics, schoolName, accessToken);

      // 4. Firestore에 저장
      await saveUserSheet({
        userId,
        sheetId: newSheetId,
        sheetUrl: newSheetUrl,
        webAppUrl: null,
        templateId,
      });

      await loadUserSheet();
      alert('논의 자료 시트가 생성되었습니다!\n\n시트를 열어서 확인하세요.');
    } catch (error: any) {
      console.error('시트 생성 실패:', error);
      let errorMessage = '시트 생성에 실패했습니다.';

      if (error.message?.includes('액세스 토큰이 없습니다') || error.message?.includes('다시 로그인')) {
        errorMessage = 'Google 인증이 만료되었습니다.\n\n로그아웃 후 다시 로그인해주세요.';
      } else if (error.message?.includes('popup')) {
        errorMessage = '팝업이 차단되었습니다.\n\n브라우저에서 팝업을 허용하고 다시 시도해주세요.';
      } else if (error.message?.includes('cancelled')) {
        errorMessage = 'Google 인증이 취소되었습니다.';
      } else {
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

      // 1. Firestore에 업무 추가
      await createDiscussionTopic({ name: topicName, order }, userId);

      // 2. 모든 사용자의 Google Sheets에 탭 추가
      const accessToken = localStorage.getItem('googleAccessToken');
      if (accessToken) {
        try {
          const userSheets = await getAllUserSheets();
          const schoolName = localStorage.getItem('schoolName') || '2025학년도 경남초등학교 교육과정 워크숍';

          let successCount = 0;
          let failureCount = 0;

          for (const userSheet of userSheets) {
            try {
              // 새 탭 추가
              await addSheetTab(userSheet.sheetId, topicName, accessToken);
              // 초기 데이터 설정
              await setupSheetTabData(userSheet.sheetId, topicName, schoolName, topicName, accessToken);
              successCount++;
            } catch (sheetError) {
              console.error(`시트 탭 추가 실패 (userId: ${userSheet.userId}):`, sheetError);
              failureCount++;
            }
          }

          if (failureCount > 0) {
            alert(`업무가 추가되었습니다.\n\nGoogle Sheets 탭 추가 결과:\n- 성공: ${successCount}개\n- 실패: ${failureCount}개`);
          }
        } catch (sheetsError) {
          console.error('Google Sheets 탭 추가 실패:', sheetsError);
        }
      }

      await loadTopics();
      setNewTopicName('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('업무 생성 실패:', error);
      alert('업무 생성에 실패했습니다.');
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

      // 1. Firestore에서 업무 이름 변경
      await updateDiscussionTopic(topicId, { name: trimmedNewName });

      // 2. 모든 사용자의 Google Sheets에서 탭 이름 변경
      const accessToken = localStorage.getItem('googleAccessToken');
      if (accessToken && oldName) {
        try {
          const userSheets = await getAllUserSheets();
          let successCount = 0;
          let failureCount = 0;

          for (const userSheet of userSheets) {
            try {
              // 기존 탭 찾기
              const tabs = await getSheetTabs(userSheet.sheetId, accessToken);
              const targetTab = tabs.find(tab => tab.title === oldName);

              if (targetTab) {
                // 탭 이름 변경
                await renameSheetTab(userSheet.sheetId, targetTab.sheetId, trimmedNewName, accessToken);
                // E1:E2 셀의 업무명도 변경
                await setupSheetTabData(
                  userSheet.sheetId,
                  trimmedNewName,
                  localStorage.getItem('schoolName') || '2025학년도 경남초등학교 교육과정 워크숍',
                  trimmedNewName,
                  accessToken
                );
                successCount++;
              }
            } catch (sheetError) {
              console.error(`시트 탭 이름 변경 실패 (userId: ${userSheet.userId}):`, sheetError);
              failureCount++;
            }
          }

          if (failureCount > 0) {
            alert(`업무 이름이 변경되었습니다.\n\nGoogle Sheets 탭 이름 변경 결과:\n- 성공: ${successCount}개\n- 실패: ${failureCount}개`);
          }
        } catch (sheetsError) {
          console.error('Google Sheets 탭 이름 변경 실패:', sheetsError);
        }
      }

      await loadTopics();
      setEditingTopic(null);
    } catch (error) {
      console.error('업무 수정 실패:', error);
      alert('업무 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (topicId: string) => {
    const topicToDelete = topics.find(t => t.id === topicId);
    if (!topicToDelete) return;

    if (!confirm(`'${topicToDelete.name}' 업무를 삭제하시겠습니까?\n관련된 Google Sheets 시트도 삭제됩니다.`)) {
      return;
    }

    try {
      const topicName = topicToDelete.name;

      // 1. 모든 사용자의 Google Sheets에서 탭 삭제
      const accessToken = localStorage.getItem('googleAccessToken');
      if (accessToken) {
        try {
          const userSheets = await getAllUserSheets();
          let successCount = 0;
          let failureCount = 0;

          for (const userSheet of userSheets) {
            try {
              // 해당 이름의 탭 찾기
              const tabs = await getSheetTabs(userSheet.sheetId, accessToken);
              const targetTab = tabs.find(tab => tab.title === topicName);

              if (targetTab) {
                // 탭 삭제
                await deleteSheetTab(userSheet.sheetId, targetTab.sheetId, accessToken);
                successCount++;
              }
            } catch (sheetError) {
              console.error(`시트 탭 삭제 실패 (userId: ${userSheet.userId}):`, sheetError);
              failureCount++;
            }
          }

          if (failureCount > 0) {
            alert(`업무가 삭제되었습니다.\n\nGoogle Sheets 탭 삭제 결과:\n- 성공: ${successCount}개\n- 실패: ${failureCount}개`);
          }
        } catch (sheetsError) {
          console.error('Google Sheets 탭 삭제 실패:', sheetsError);
        }
      }

      // 2. Firestore에서 업무 삭제
      await deleteDiscussionTopic(topicId);
      await loadTopics();
    } catch (error) {
      console.error('업무 삭제 실패:', error);
      alert('업무 삭제에 실패했습니다.');
    }
  };

  const handleMoveUp = async (topic: any, index: number) => {
    if (index === 0) return;

    try {
      const prevTopic = topics[index - 1];
      await updateDiscussionTopic(topic.id, { order: prevTopic.order });
      await updateDiscussionTopic(prevTopic.id, { order: topic.order });
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
      await updateDiscussionTopic(topic.id, { order: nextTopic.order });
      await updateDiscussionTopic(nextTopic.id, { order: topic.order });
      await loadTopics();
    } catch (error) {
      console.error('순서 변경 실패:', error);
      alert('순서 변경에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">논의 자료 (업무) 관리</h2>
          <p className="text-sm text-gray-500 mt-1">
            워크숍에서 논의할 업무를 관리합니다. 각 업무는 Google Sheets에서 별도의 시트로 생성됩니다.
          </p>
          {userSheet && (
            <div className="mt-2">
              <a
                href={userSheet.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                📊 내 논의 자료 시트 열기
              </a>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {!userSheet && (
            <button
              onClick={handleCreateUserSheet}
              disabled={isCreatingSheet}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isCreatingSheet ? '생성 중...' : '📋 내 시트 생성'}
            </button>
          )}
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold shadow-md"
          >
            {showCreateForm ? '취소' : '+ 새 업무 추가'}
          </button>
        </div>
      </div>

      {/* 업무 추가 폼 */}
      {showCreateForm && (
        <div className="bg-orange-50 rounded-xl p-6 border-2 border-orange-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">새 업무 추가</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="업무 이름 (예: 교육과정, 생활지도, 방과후)"
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
              maxLength={30}
            />
            <button
              onClick={handleCreate}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* 업무 목록 */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-lg">목록을 불러오는 중...</p>
          </div>
        ) : topics.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">등록된 업무가 없습니다</p>
            <p className="text-gray-400 text-sm mt-2">새 업무 추가 버튼을 눌러 업무를 등록하세요</p>
          </div>
        ) : (
          topics.map((topic, index) => (
            <div key={topic.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveUp(topic, index)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="위로 이동"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveDown(topic, index)}
                      disabled={index === topics.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="아래로 이동"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {editingTopic?.id === topic.id ? (
                    <input
                      type="text"
                      defaultValue={topic.name}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdate(topic.id, (e.target as HTMLInputElement).value);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value !== topic.name) {
                          handleUpdate(topic.id, e.target.value);
                        } else {
                          setEditingTopic(null);
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900"
                      autoFocus
                      maxLength={30}
                    />
                  ) : (
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800">{topic.name}</h3>
                      <p className="text-sm text-gray-500">순서: {index + 1}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {editingTopic?.id === topic.id ? (
                    <button
                      onClick={() => setEditingTopic(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-semibold"
                    >
                      취소
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingTopic(topic)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(topic.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
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
            <li>• 업무 순서는 위/아래 화살표로 조정할 수 있습니다.</li>
            <li>• 각 업무는 Google Sheets에서 별도 시트로 관리됩니다.</li>
            <li>• 업무 삭제 시 해당 Google Sheets 시트도 함께 삭제됩니다.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
