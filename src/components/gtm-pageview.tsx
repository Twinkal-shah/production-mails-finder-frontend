"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

export default function GtmPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams?.toString() ?? ""
    const url = query ? `${pathname}?${query}` : pathname
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: "pageview",
      page_path: url,
    })
  }, [pathname, searchParams])

  return null
}
