import type { Metadata } from 'next'
import { Gowun_Dodum } from 'next/font/google'
import './globals.css'

const gowunDodum = Gowun_Dodum({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '교육과정 워크숍',
  description: '실시간 의견 취합 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={gowunDodum.className}>
      <body>{children}</body>
    </html>
  )
}
