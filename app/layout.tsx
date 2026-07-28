import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "柏駅・夜間観察 3Dマインドマップ",
  description: "柏駅周辺で収集した夜間観察コメントを、2つのルートから広がる3Dマインドマップとして探索する。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
