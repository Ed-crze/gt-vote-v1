import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GT-Vote — GCTU E-Voting System',
  description: 'Secure. Anonymous. Your voice matters.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* Background stays mounted across all page navigations — never flashes */}
        <div className="global-bg" />
        <div className="global-overlay" />
        <div className="global-content">
          {children}
        </div>
      </body>
    </html>
  )
}
