import type { Metadata } from "next"
import { Bricolage_Grotesque } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { QueryProvider } from "@/components/providers/query-provider"
import { StartupInitializer } from "@/components/startup-initializer"

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geist-sans",
})

export const metadata: Metadata = {
  title: "MailsFinder Dashboard",
  description: "Find and verify email addresses with MailsFinder",
  icons: {
    icon: [
      { url: '/Mailsfinder black - Fav (1).png', type: 'image/png' },
    ],
    shortcut: '/Mailsfinder black - Fav (1).png',
    apple: '/Mailsfinder black - Fav (1).png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${bricolage.variable} font-sans antialiased`}
      >
        <QueryProvider>
          <StartupInitializer />
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
