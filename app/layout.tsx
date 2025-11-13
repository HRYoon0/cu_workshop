import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '교육과정 워크숍',
  description: '실시간 퀴즈 및 설문 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
