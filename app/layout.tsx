import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const displayFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Muhammad A. Fattah - Software Engineer",
  description:
    "Software engineer focused on payment systems, Android, reliability, observability, and secure mobile-client behavior.",
  openGraph: {
    title: "Muhammad A. Fattah - Software Engineer",
    description:
      "Software engineer focused on payment systems, Android, reliability, observability, and secure mobile-client behavior.",
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
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
