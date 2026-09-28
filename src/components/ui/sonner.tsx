"use client"

import * as React from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

/**
 * The app toggles the theme by putting `dark` on <html> (see the theme
 * bootstrap in the root layout and the header switch), and there is no
 * next-themes provider mounted. Reading next-themes here always resolved to
 * "system", so toasts followed the OS rather than the app and could come up
 * light on a dark workspace. Watching the class keeps them in step.
 */
function useDocumentTheme(): "light" | "dark" {
  const [theme, setTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    const root = document.documentElement
    const read = () => setTheme(root.classList.contains("dark") ? "dark" : "light")
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
