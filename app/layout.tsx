import type { Metadata } from "next";
import { Geist, Roboto_Slab } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import Nav from "@/components/nav";
import { AppProviders } from "@/components/providers/app-providers";

const robotoSlab = Roboto_Slab({ subsets: ['latin'], variable: '--font-serif' });

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "AutoBot",
  description: "The fastest way to build apps with AutoBot",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-serif", robotoSlab.variable)}>
      <body className={`${geistSans.className} h-screen overflow-hidden antialiased`}>
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
