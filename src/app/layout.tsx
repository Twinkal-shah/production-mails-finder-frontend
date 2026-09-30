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
        {/* PostHog. Reports into the SAME project as mailsfinder.com (620204, US
            cloud) so an anonymous marketing visit and the identified app user
            resolve to one person — cross_subdomain_cookie and cookieWinsOnConflict
            are what make that work and must not be changed.

            The project key is a public, write-only client key; it is meant to ship
            in front-end source and cannot read data out. Loaded via the official
            snippet rather than the npm package, matching how GTM and Tawk.to are
            already installed here. Sits above GTM, and below theme-init only so the
            pre-paint theme fix keeps its head start. */}
        <Script id="posthog-init" strategy="beforeInteractive">{`!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_yKkJ7jt7TZSMvuqnvJMXHX6Rixo8yNToLkcUsDKVyKwd', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'always',
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: true,
    cookieWinsOnConflict: true,
    capture_pageleave: true,
    session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]'
    }
});
// Tells app events apart from marketing events without filtering on hostname.
posthog.register({ site: 'app' });`}</Script>
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
