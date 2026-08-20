import type { Metadata } from "next";
import { WorkspaceManagerProvider } from "@/components/workspace-manager";
import { LimitedAnalytics } from "@/components/limited-analytics";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./globals.css";
import "./design-tokens.css";
import "./window-system.css";

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
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <WorkspaceManagerProvider>{children}</WorkspaceManagerProvider>
        <LimitedAnalytics production={process.env.VERCEL_ENV === "production"} />
      </body>
    </html>
  );
}
