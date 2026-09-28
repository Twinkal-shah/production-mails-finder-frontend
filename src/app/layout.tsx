import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { QueryProvider } from "@/components/providers/query-provider"
import { StartupInitializer } from "@/components/startup-initializer"
import Script from "next/script"
import GtmPageview from "../components/gtm-pageview"
import { Suspense } from "react"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "MailsFinder Dashboard",
  description: "Find and verify email addresses with MailsFinder",
  icons: {
    icon: [
      { url: '/favicon-v2.png', type: 'image/png' },
    ],
    shortcut: '/favicon-v2.png',
    apple: '/favicon-v2.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The theme class lives on <html>, but it used to be applied only once
            the dashboard shell mounted. Any route outside that shell (onboarding,
            auth, thank-you, ...) therefore rendered with light-mode colours on a
            dark canvas. Applying it before first paint keeps every route on the
            same theme and removes the flash. */}
        <Script id="theme-init" strategy="beforeInteractive">{`(function(){try{
var s=localStorage.getItem('theme');
var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.classList.toggle('dark',d);
}catch(e){}})();`}</Script>
        <Script id="gtm-init" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WV6JKFGV');`}</Script>
        {/* Tawk.to live chat */}
        <Script id="tawk-to" strategy="afterInteractive">{`var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/6ab15d01e5c88d344092eb09/1k32d6kes';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();`}</Script>
      </head>
      <body
        className={`${spaceGrotesk.className} antialiased`}
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
