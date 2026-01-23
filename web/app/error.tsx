'use client';

import { ErrorBoundary } from '@/components/error-boundary';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Application Error"
      description="An unexpected error occurred in the application. Please try again or contact support if the problem persists."
    />
  );
}
