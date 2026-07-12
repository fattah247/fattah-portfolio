import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { WorkspaceManagerProvider } from "@/components/workspace-manager";
import "./globals.css";
import "./window-system.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Muhammad A. Fattah — Software Engineer",
    template: "%s — Muhammad A. Fattah",
  },
  description:
    "Engineering cases about payment reliability, service degradation, and Android device trust.",
  openGraph: {
    title: "Muhammad A. Fattah — Software Engineer",
    description:
      "Public engineering cases about payment reliability, observability, and secure mobile-client behavior.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${monoFont.variable}`}>
        <WorkspaceManagerProvider>{children}</WorkspaceManagerProvider>
        <Analytics />
      </body>
    </html>
  );
}
