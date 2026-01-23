'use client';

import { ErrorBoundary } from '@/components/error-boundary';

export default function DashboardError({
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
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    />
  );
}
