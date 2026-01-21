import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * Server-side admin check that redirects non-admins to /bills
 * Use this in server components/pages that should only be accessible to admins
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/bills');
  }

  return session;
}

/**
 * Check if the current user is an admin
 * Returns boolean, doesn't redirect
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}

/**
 * Get the current session if user is admin, otherwise null
 */
export async function getAdminSession() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return null;
  }

  return session;
}
