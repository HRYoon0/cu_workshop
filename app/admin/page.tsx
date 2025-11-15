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
  createQuizSession,
  createSurveySession,
  isApprovedUser,
  getPendingUsers,
  approveUser,
  rejectUser
} from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import ImageUploader from '@/components/ImageUploader';
import { renameSchoolFolder } from '@/lib/googleDrive';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'quiz' | 'survey' | 'approval'>('quiz');
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

      // 2. Google Drive 폴더 이름 변경 (비동기로 처리, 실패해도 앱은 계속 작동)
      try {
        const accessToken = localStorage.getItem('googleAccessToken');
        if (accessToken && oldName !== newName) {
          await renameSchoolFolder(oldName, newName, accessToken);
          alert('학교 이름과 Google Drive 폴더가 성공적으로 변경되었습니다!');
        }
      } catch (driveError) {
        console.error('Google Drive 폴더 이름 변경 실패:', driveError);
        alert('학교 이름은 변경되었지만, Google Drive 폴더 이름 변경에 실패했습니다.\n다음번 파일 업로드 시 새 폴더가 생성됩니다.');
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
          pendingUsers.map((pendingUser) => (
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

  const handleQuizDelete = async (quizId: string) => {
    if (!confirm('이 퀴즈를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteQuiz(quizId);
      setQuizzes(quizzes.filter(q => q.id !== quizId));
      // 생성 폼이 열려있으면 닫기
      setShowCreateForm(false);
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
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
        >
          {showCreateForm ? '취소' : '+ 새 퀴즈 만들기'}
        </button>
      </div>

      {/* 퀴즈 생성 폼 */}
      {showCreateForm && (
        <QuizCreateForm
          onClose={() => setShowCreateForm(false)}
          onCreated={handleQuizCreated}
          userId={userId}
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
          quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} onDelete={handleQuizDelete} />
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

  const handleSurveyDelete = async (surveyId: string) => {
    if (!confirm('이 설문을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteSurvey(surveyId);
      setSurveys(surveys.filter(s => s.id !== surveyId));
      // 생성 폼이 열려있으면 닫기
      setShowCreateForm(false);
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
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-lg"
        >
          {showCreateForm ? '취소' : '+ 새 설문 만들기'}
        </button>
      </div>

      {/* 설문 생성 폼 */}
      {showCreateForm && (
        <SurveyCreateForm
          onClose={() => setShowCreateForm(false)}
          onCreated={handleSurveyCreated}
          userId={userId}
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
            surveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} onDelete={handleSurveyDelete} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// 퀴즈 생성 폼
function QuizCreateForm({ onClose, onCreated, userId }: { onClose: () => void; onCreated: (quiz: any) => void; userId: string }) {
  const [title, setTitle] = useState('');
  const [questionIdCounter, setQuestionIdCounter] = useState(1);
  const [questions, setQuestions] = useState([
    {
      id: 0,
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      timeLimit: 10,
      imageUrl: '',
    }
  ]);
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
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuestions(questions.map((q, idx) => {
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
    setQuestions(questions.map((q, idx) => {
      if (idx === qIndex) {
        return {
          ...q,
          options: q.options.map((opt, optIdx) =>
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

      // Firebase에 퀴즈 저장 (임시 ID 제거)
      const cleanQuestions = questions.map(({ id, ...rest }) => rest);
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
    } catch (error) {
      console.error('퀴즈 생성 실패:', error);
      alert('퀴즈 생성에 실패했습니다. 다시 시도해주세요.');
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
            <h3 className="text-2xl font-bold text-gray-800">퀴즈 생성 완료!</h3>
            <p className="text-gray-600 mt-2">{title}</p>
          </div>
        </div>
      )}

      <h3 className="text-xl font-bold text-gray-800 mb-4">새 퀴즈 만들기</h3>
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

          {questions.map((q, qIndex) => (
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
                  {q.options.map((option, optIndex) => (
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
            {isSubmitting ? '생성 중...' : '퀴즈 생성'}
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

// 설문 생성 폼
function SurveyCreateForm({ onClose, onCreated, userId }: { onClose: () => void; onCreated: (survey: any) => void; userId: string }) {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<'scale' | 'text'>('scale');
  const [timeLimit, setTimeLimit] = useState(60);
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      // Firebase에 설문 저장
      const surveyId = await createSurvey({
        title,
        question,
        type,
        timeLimit,
        imageUrl,
      }, userId);

      const survey = {
        id: surveyId,
        title,
        question,
        type,
        timeLimit,
        imageUrl,
        createdAt: new Date()
      };

      onCreated(survey);

      // 성공 메시지 표시
      setShowSuccessMessage(true);

      // 2초 후 폼 닫기
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('설문 생성 실패:', error);
      alert('설문 생성에 실패했습니다. 다시 시도해주세요.');
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
            <h3 className="text-2xl font-bold text-gray-800">설문 생성 완료!</h3>
            <p className="text-gray-600 mt-2">{title}</p>
          </div>
        </div>
      )}

      <h3 className="text-xl font-bold text-gray-800 mb-4">새 설문 만들기</h3>
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

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '생성 중...' : '설문 생성'}
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
function QuizCard({ quiz, onDelete }: { quiz: any; onDelete: (id: string) => void }) {
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
function SurveyCard({ survey, onDelete }: { survey: any; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    try {
      setIsStarting(true);
      const sessionId = await createSurveySession(survey.id);
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
