import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from "@/components/theme-provider";
import SessionGuard from "@/components/SessionGuard";

export const metadata: Metadata = {
  title: 'GT-Vote — GCTU E-Voting System',
  description: 'Secure. Anonymous. Your voice matters.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange
          storageKey="gtvote-theme"
        >
          {/* Background stays mounted across all page navigations — never flashes */}
          <div className="global-bg" />
          <div className="global-overlay" />
          <div className="global-content">
            {/* Inactivity timeout. Skips public routes internally; the layout
                never unmounts, so the countdown survives page transitions. It
                wraps children so protected content can be held back until the
                stale-session check resolves. */}
            <SessionGuard>{children}</SessionGuard>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}