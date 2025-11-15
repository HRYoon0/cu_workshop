import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            교육과정 워크숍
          </h1>
          <p className="text-xl text-gray-600">
            실시간 퀴즈 및 설문 시스템
          </p>
        </div>

        {/* 관리자 로그인 버튼 */}
        <Link href="/login">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer border-4 border-transparent hover:border-blue-500">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-3">
              관리자 로그인
            </h2>
            <p className="text-gray-600 text-center">
              Google 계정으로 로그인하여 퀴즈를 생성하고 진행하세요
            </p>
          </div>
        </Link>

        <p className="text-center text-gray-500 text-sm mt-8">
          참여자는 관리자가 제공하는 QR 코드로 접속합니다
        </p>
      </div>
    </main>
  );
}
