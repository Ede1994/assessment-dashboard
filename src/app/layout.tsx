import type { Metadata } from "next";
import { Fira_Code, Inter } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fira = Fira_Code({
  variable: "--font-fira",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Student Assessment Platform",
  description:
    "Prototype assessment platform for medical data engineering, CT/MRI, PyTorch, and AI tasks.",
};

const themeInit = `(function(){try{if(localStorage.getItem("assessment-theme")==="light"){var e=document.documentElement;e.classList.add("light");e.classList.remove("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fira.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 custom-scrollbar">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
