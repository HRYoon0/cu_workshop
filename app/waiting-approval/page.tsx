'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { isApprovedUser } from '@/lib/firestore';
import { signOut } from 'firebase/auth';

export default function WaitingApprovalPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 로그인 상태 확인
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        // 로그인되지 않은 경우 로그인 페이지로
        router.push('/login');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    // 5초마다 승인 여부 확인
    const checkApproval = async () => {
      const approved = await isApprovedUser(user.uid);
      if (approved) {
        router.push('/admin');
      }
    };

    const interval = setInterval(checkApproval, 5000);

    // 첫 실행
    checkApproval();

    return () => clearInterval(interval);
  }, [user, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center">
          {/* 시계 아이콘 */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-3">
            승인 대기 중
          </h1>

          <p className="text-gray-600 mb-2">
            관리자의 승인을 기다리고 있습니다.
          </p>

          <p className="text-sm text-gray-500 mb-8">
            승인되면 자동으로 페이지가 전환됩니다.
          </p>

          {user && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-3">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt="프로필"
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="text-left">
                  <p className="font-medium text-gray-800">{user.displayName}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
