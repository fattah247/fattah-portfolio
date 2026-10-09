import type { Metadata } from "next";
import { WorkspaceManagerProvider } from "@/components/workspace-manager";
import { LimitedAnalytics } from "@/components/limited-analytics";
import { portfolioTitle } from "@/lib/portfolio-identity";
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
import "./environment.css";

export const metadata: Metadata = {
  title: {
    default: portfolioTitle.default,
    template: portfolioTitle.template,
  },
  description:
    "Engineering cases about payment reliability, service degradation, and Android device trust.",
  openGraph: {
    title: portfolioTitle.default,
    description:
      "Engineering cases about payment reliability, service degradation, and Android device trust.",
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
