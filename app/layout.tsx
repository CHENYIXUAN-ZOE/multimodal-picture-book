import "./globals.css";

export const metadata = {
  title: "多模态绘本｜把知识变成会发光的故事",
  description:
    "本地优先、安全可控的儿童科普与故事绘本创作工作台。",
  openGraph: {
    title: "多模态绘本｜把知识变成会发光的故事",
    description: "本地优先、安全可控的儿童科普与故事绘本创作工作台。",
    images: ["/multimodal-picture-book-cover.png"],
  },
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
