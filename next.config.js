/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Firebase Hosting용 static export
  images: {
    unoptimized: true, // Static export에서는 이미지 최적화 비활성화
  },
}

module.exports = nextConfig
