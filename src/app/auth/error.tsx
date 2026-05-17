"use client";

import { ErrorBoundaryPage } from "@/components/ui/error-boundary-page";

export default function AuthError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryPage {...props} scope="auth" homeHref="/auth" homeLabel="Back to sign in" />;
}
