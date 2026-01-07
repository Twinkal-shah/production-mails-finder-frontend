import type { Metadata } from "next"
import { Bricolage_Grotesque } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { QueryProvider } from "@/components/providers/query-provider"
import { StartupInitializer } from "@/components/startup-initializer"
import Script from "next/script"
import GtmPageview from "../components/gtm-pageview"
import { Suspense } from "react"

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
      <head>
        <Script id="gtm-init" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WV6JKFGV');`}</Script>
      </head>
      <body
        className={`${bricolage.variable} font-sans antialiased`}
      >
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WV6JKFGV" height="0" width="0" style={{ display: "none", visibility: "hidden" }}></iframe></noscript>
        <QueryProvider>
          <Suspense fallback={null}>
            <GtmPageview />
          </Suspense>
          <StartupInitializer />
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
