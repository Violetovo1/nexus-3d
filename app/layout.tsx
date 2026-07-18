import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI·3D越境科技｜图片生成3D模型",
  description:
    "AI·3D越境科技图片生成三维模型演示工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
