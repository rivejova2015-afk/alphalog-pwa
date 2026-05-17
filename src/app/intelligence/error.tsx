"use client";

import { ErrorBoundaryPage } from "@/components/ui/error-boundary-page";

export default function IntelligenceError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryPage {...props} scope="intelligence" />;
}
