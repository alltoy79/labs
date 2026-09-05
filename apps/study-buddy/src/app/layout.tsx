import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "스터디버디 — 하루 5문제",
    template: "%s · 스터디버디",
  },
  description: "초등 4학년부터 중학교 3학년까지, 국어·사회·과학을 하루 5문제씩.",
  applicationName: "스터디버디",
  // iOS 에서 홈 화면에 추가했을 때 전체화면으로 뜨게 한다
  appleWebApp: {
    capable: true,
    title: "스터디버디",
    statusBarStyle: "default",
  },
  // 아직 검색 노출 단계가 아니다
  robots: { index: false, follow: false },
  other: {
    // Next 16 은 표준 태그(mobile-web-app-capable)만 출력한다.
    // iOS 16.4+ 는 manifest 의 display:standalone 을 따르지만,
    // 그 이전 버전을 위해 레거시 태그를 함께 넣는다.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  // 확대를 막지 않는다 — 아이가 쓰는 앱이라 접근성이 우선
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
