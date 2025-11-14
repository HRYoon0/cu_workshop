/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel 배포용 - 동적 라우트와 서버 기능 사용
  images: {
    unoptimized: true, // Google Drive 이미지 사용을 위해 최적화 비활성화
  },
}

module.exports = nextConfig
