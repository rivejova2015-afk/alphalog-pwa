"use client";

import { ErrorBoundaryPage } from "@/components/ui/error-boundary-page";

export default function SecuritiesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryPage {...props} scope="securities" homeHref="/securities/cybersec" homeLabel="Go to CyberSec" />;
}
