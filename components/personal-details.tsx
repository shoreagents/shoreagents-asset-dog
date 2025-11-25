'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel, FieldContent } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { z } from 'zod'

const personalDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type PersonalDetailsFormData = z.infer<typeof personalDetailsSchema>

interface UserData {
  id: string
  name: string
  email: string
  role: string
}

async function fetchCurrentUser(): Promise<UserData> {
  const response = await fetch('/api/auth/me')
  if (!response.ok) {
    throw new Error('Failed to fetch user data')
  }
  const data = await response.json()
  return {
    id: data.user.id,
    name: data.user.name || '',  // Name is now included from user_metadata in API response
    email: data.user.email,
    role: data.permissions?.role || 'user',
  }
}

async function updateUser(data: { name?: string }) {
  const response = await fetch('/api/auth/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update user')
  }
  return response.json()
}

export default function PersonalDetails() {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  const { data: user, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
  })

  const form = useForm<PersonalDetailsFormData>({
    resolver: zodResolver(personalDetailsSchema),
    defaultValues: {
      name: '',
    },
  })

  // Populate form when user data is loaded
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
      })
    }
  }, [user, form])

  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      // Invalidate both query keys to update all components that display user data
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar-user'] })
      toast.success('Profile updated successfully')
      setIsEditing(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile')
    },
  })

  const onSubmit = (data: PersonalDetailsFormData) => {
    updateMutation.mutate(data)
  }

  if (isLoading) {
    return (
      <Card 
        className="border-l-4 transition-all duration-200 hover:shadow-md" 
        style={{ borderLeftColor: '#3b82f6' }}
      >
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>
            Update your personal information and contact details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <FieldContent>
                  <Skeleton className="h-10 w-full" />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email Address</FieldLabel>
                <FieldContent>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-3 w-48 mt-1" />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Role</FieldLabel>
                <FieldContent>
                  <Skeleton className="h-10 w-full" />
                </FieldContent>
              </Field>

              <Field>
                <Skeleton className="h-10 w-32" />
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card className="border-l-4" style={{ borderLeftColor: '#3b82f6' }}>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Failed to load user data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      className="border-l-4 transition-all duration-200 hover:shadow-md" 
      style={{ borderLeftColor: '#3b82f6' }} // blue-500
    >
      <CardHeader>
        <CardTitle>Personal Details</CardTitle>
        <CardDescription>
          Update your personal information and contact details
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <FieldContent>
                <Input
                  id="name"
                  {...form.register('name')}
                  disabled={!isEditing || updateMutation.isPending}
                  aria-invalid={form.formState.errors.name ? 'true' : 'false'}
                />
                {form.formState.errors.name && (
                  <FieldError>{form.formState.errors.name.message}</FieldError>
                )}
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <FieldContent>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                  aria-label="Email address (cannot be changed)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email address cannot be changed
                </p>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Role</FieldLabel>
              <FieldContent>
                <Input
                  value={user.role}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </FieldContent>
            </Field>

            <Field>
              {!isEditing ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIsEditing(true)
                    form.reset({
                      name: user.name,
                    })
                  }}
                >
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      form.reset({
                        name: user.name,
                      })
                    }}
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

