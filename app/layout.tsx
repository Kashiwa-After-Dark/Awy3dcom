import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3Dcomment",
  description: "柏駅周辺で収集した夜間観察データを、時刻・人数・属性で読み解く3Dネットワークマップ。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
