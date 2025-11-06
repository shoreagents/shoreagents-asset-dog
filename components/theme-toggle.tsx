"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme((theme) => (theme === "dark" ? "light" : "dark"))
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex size-9 items-center justify-center rounded-md border bg-background hover:bg-accent relative"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </button>
  )
}

