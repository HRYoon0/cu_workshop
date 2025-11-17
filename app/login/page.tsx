'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { isApprovedUser, addPendingUser, approveUser } from '@/lib/firestore';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serverTimestamp } from 'firebase/firestore';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');

      // Google 로그인 (Drive 권한 포함)
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Google Drive 액세스 토큰 저장
      const googleCredential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = googleCredential?.accessToken;

      if (accessToken) {
        localStorage.setItem('googleAccessToken', accessToken);
        console.log('Google Drive 액세스 토큰 저장 완료');
      } else {
        console.warn('Google Drive 액세스 토큰을 가져올 수 없습니다.');
      }

      // 관리자 UID 확인
      const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
      const isAdmin = user.uid === adminUid;

      // 승인된 사용자인지 확인
      const approved = await isApprovedUser(user.uid);

      if (approved) {
        // 승인된 사용자 -> 관리자 페이지로
        router.push('/admin');
      } else if (isAdmin) {
        // 관리자인 경우 자동 승인
        await addDoc(collection(db, 'approvedUsers'), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          approvedAt: serverTimestamp(),
          approvedBy: user.uid, // 자기 자신이 승인
        });
        router.push('/admin');
      } else {
        // 승인되지 않은 사용자 -> pendingUsers에 추가 후 대기 화면으로
        await addPendingUser(
          user.uid,
          user.email || '',
          user.displayName,
          user.photoURL
        );
        router.push('/waiting-approval');
      }
    } catch (err: any) {
      console.error('로그인 실패:', err);
      setError(err.message || '로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            교육과정 워크숍 시스템
          </h1>
          <p className="text-gray-600">
            Google 계정으로 로그인하세요
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? '로그인 중...' : 'Google로 로그인'}
        </button>

        <div className="text-sm text-gray-500 text-center mt-6 space-y-1">
          <p>처음 로그인하시는 경우 관리자의 승인이 필요합니다.</p>
          <p className="text-xs whitespace-nowrap">Google 권한: Drive 관리, Sheets 읽기/쓰기, 이미지 업로드</p>
        </div>
      </div>
    </div>
  );
}
