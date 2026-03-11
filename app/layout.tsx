import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import Nav from "@/components/nav";
import { AppProviders } from "@/components/providers/app-providers";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "AutoBot",
  description: "The fastest way to build apps with AutoBot",
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
                <Nav />
                {children}
              </div>
            </AppProviders>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
