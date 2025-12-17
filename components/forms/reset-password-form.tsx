"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dog, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { resetPasswordSchema, type ResetPasswordFormData } from "@/lib/validations/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Get the code or access_token from URL query parameter directly
  // Supabase can send either 'code' (from email redirect) or 'access_token' (from direct link)
  const urlCode = searchParams.get('code')
  const accessToken = searchParams.get('access_token')
  const code = urlCode || accessToken
  
  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const isLoading = form.formState.isSubmitting

  useEffect(() => {
    // Validate that we have a code or access_token
    if (!code) {
      toast.error('Invalid or missing reset code. Please request a new password reset.')
      router.push('/login')
    }
  }, [code, router])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!code) {
      toast.error('Invalid reset code')
      return
    }

    try {
      const baseUrl = getApiBaseUrl()
      const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send cookies for authentication
        body: JSON.stringify({
          code,
          password: data.password,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        toast.error(responseData.error || 'Failed to reset password')
        return
      }

      // Password reset successful
      toast.success('Password reset successful. Please login with your new password.')
      router.push('/login?message=Password reset successful')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred")
    }
  }

  if (!code) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary">
            <Dog className="size-10" />
          </div>
          <h1 className="text-xl font-bold">Invalid Reset Link</h1>
          <p className="text-sm text-muted-foreground">The password reset link is invalid or has expired.</p>
        </div>
        <Button onClick={() => router.push('/login')}>
          Go to Login
        </Button>
      </div>
    )
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
              <div className="flex size-12 items-center justify-center rounded-full bg-primary">
                <Dog className="size-10" />
              </div>
              <span className="sr-only">Asset Dog</span>
            </a>
            <h1 className="text-xl font-bold">Reset Your Password</h1>
            <p className="text-sm text-muted-foreground">Enter your new password below</p>
          </div>

          <Field>
            <FieldLabel htmlFor="password">New Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your new password"
                autoComplete="new-password"
                {...form.register("password")}
                aria-invalid={form.formState.errors.password ? "true" : "false"}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {form.formState.errors.password && (
              <FieldError>{form.formState.errors.password.message}</FieldError>
            )}
          </Field>
          
          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                {...form.register("confirmPassword")}
                aria-invalid={form.formState.errors.confirmPassword ? "true" : "false"}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {form.formState.errors.confirmPassword && (
              <FieldError>{form.formState.errors.confirmPassword.message}</FieldError>
            )}
          </Field>
          
          <Field>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Resetting Password..." : "Reset Password"}
            </Button>
          </Field>
          
          <FieldDescription>
            Remember your password? <a href="/login" className="text-primary hover:underline">Back to Login</a>
          </FieldDescription>
        </FieldGroup>
      </form>
    </div>
  )
}

