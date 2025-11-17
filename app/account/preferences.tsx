'use client'

import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Preferences() {
  const { theme, setTheme } = useTheme()

  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      icon: Sun,
      description: 'Light mode',
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: Moon,
      description: 'Dark mode',
    },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      description: 'Use system preference',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Customize your application preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Selection */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Appearance</h3>
            <p className="text-sm text-muted-foreground">
              Choose your preferred theme. Changes will be applied immediately.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isSelected = theme === option.value || (option.value === 'system' && theme === 'system')

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-3 p-4 h-auto rounded-lg border-2 transition-all',
                    'hover:bg-accent hover:border-accent-foreground/20',
                    isSelected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border bg-card'
                  )}
                >
                  <div className={cn(
                    'p-3 rounded-md transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      isSelected ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </Button>
              )
            })}
          </div>
          
        </div>
      </CardContent>
    </Card>
  )
}

