import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProviders } from "@/components/providers/app-providers";
import { Toaster } from "@/components/ui/sonner";
import { seoDefaults } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: seoDefaults.siteName,
    template: `%s | ${seoDefaults.siteName}`,
  },
  description: seoDefaults.defaultDescription,
  applicationName: seoDefaults.siteName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: seoDefaults.siteName,
    type: "website",
    locale: "en_US",
    title: seoDefaults.siteName,
    description: seoDefaults.defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: seoDefaults.siteName,
    description: seoDefaults.defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen overflow-hidden antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <AppProviders>
              <div className="flex h-screen flex-col overflow-hidden">
                {children}
              </div>
              <Toaster />
            </AppProviders>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
