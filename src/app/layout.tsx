import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "LeadOS — منصة ذكاء العملاء المحتملين",
  description:
    "منصة ذكية لتوليد وإدارة العملاء المحتملين 24/7: اكتشاف آلي، تصنيف بالذكاء الاصطناعي، بحث عميق، CRM، وتحليلات.",
  keywords: ["Lead Intelligence", "CRM", "AI", "Leads", "اكتشاف عملاء", "ذكاء اصطناعي"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Cairo:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
