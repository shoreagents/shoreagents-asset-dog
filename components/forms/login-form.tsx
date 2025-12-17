"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dog } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { loginSchema, type LoginFormData } from "@/lib/validations/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase-client"

const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const isLoading = form.formState.isSubmitting

  useEffect(() => {
    const message = searchParams.get('message')
    if (message) {
      toast.success(message)
      // Clear the message from URL
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  const onSubmit = async (data: LoginFormData) => {
    try {
      const baseUrl = getApiBaseUrl()
      const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
      
      if (useFastAPI) {
        // FastAPI: Make request and set session in Supabase client
        const response = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        })

        const responseData = await response.json()

        if (!response.ok) {
          toast.error(responseData.detail || responseData.error || 'Failed to login')
          return
        }

        // Set session in Supabase client
        if (responseData.session) {
          const supabase = createClient()
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: responseData.session.access_token,
            refresh_token: responseData.session.refresh_token,
          })
          
          if (sessionError) {
            console.error('Failed to set session:', sessionError)
            toast.error('Failed to set session. Please try again.')
            return
          }
        }
      } else {
        // Next.js API: Standard flow
        const response = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        })

        const responseData = await response.json()

        if (!response.ok) {
          toast.error(responseData.error || 'Failed to login')
          return
        }
      }

      // Login successful, check for redirect parameter
      const redirectTo = searchParams.get('redirect') || '/dashboard'
      toast.success('Login successful')
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred")
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-primary ">
                <Dog className="size-10" />
              </div>
              <span className="sr-only">Asset Dog</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to Asset Dog</h1>
            <p className="text-sm text-muted-foreground">Your comprehensive asset management solution</p>
          </div>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              {...form.register("email")}
              aria-invalid={form.formState.errors.email ? "true" : "false"}
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <FieldError>{form.formState.errors.email.message}</FieldError>
            )}
          </Field>
          
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="off"
              {...form.register("password")}
              aria-invalid={form.formState.errors.password ? "true" : "false"}
              disabled={isLoading}
            />
            {form.formState.errors.password && (
              <FieldError>{form.formState.errors.password.message}</FieldError>
            )}
          </Field>
          
          <Field>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </Field>
          
          <FieldDescription className="text-center">
            Don&apos;t have an account? <a href="/signup" className="text-primary hover:underline">Sign up</a>
          </FieldDescription>
        </FieldGroup>
      </form>
    </div>
  )
}
