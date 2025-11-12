"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  const toggleTheme = () => {
    // Use resolvedTheme to determine current state (handles system theme)
    const currentResolved = resolvedTheme || "light"
    setTheme(currentResolved === "dark" ? "light" : "dark")
  }

  // Determine which icon to show based on resolved theme (handles system theme)
  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={toggleTheme}
      className="flex size-9 items-center justify-center rounded-md relative cursor-pointer transition-all"
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

