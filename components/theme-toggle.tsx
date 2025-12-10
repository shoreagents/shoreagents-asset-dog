"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Only render theme-dependent content after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    // Use resolvedTheme to determine current state (handles system theme)
    const currentResolved = resolvedTheme || "light"
    setTheme(currentResolved === "dark" ? "light" : "dark")
  }

  // Determine which icon to show based on resolved theme (handles system theme)
  // Default to light theme during SSR to match initial client render
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <button
      onClick={toggleTheme}
      className="flex size-9 items-center justify-center relative cursor-pointer transition-all hover:bg-accent rounded-full dark:hover:bg-accent/50"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {isDark ? (
        <Moon className="h-4 w-4 transition-all" />
      ) : (
        <Sun className="h-4 w-4 transition-all" />
      )}
    </button>
  )
}

