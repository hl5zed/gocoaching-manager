// =============================================================================
// src/lib/auth/requireAuth.ts
// Gate for protected Server Components.
// Calls getSession() and redirects to /login if no valid session is found.
//
// Usage in a Server Component:
//   const { user } = await requireAuth()   // redirects automatically on failure
//
// NOTE — do NOT use requireAuth() directly in Route Handlers (app/api/**).
// next/navigation redirect() works in Server Components but throws an
// unhandled NEXT_REDIRECT error in Route Handlers.
// In Route Handlers, check the session manually and return NextResponse:
//   const result = await getSession()
//   if (!result.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// =============================================================================

import { redirect } from 'next/navigation'
import { getSession } from './getSession'
import type { User } from '@/types/auth'

export async function requireAuth(): Promise<{ user: User }> {
  const result = await getSession()

  if (result.error || !result.user) {
    redirect('/login')
  }

  return { user: result.user }
}