"use client";

import { ErrorBoundaryPage } from "@/components/ui/error-boundary-page";

export default function InboxError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryPage {...props} scope="inbox" homeHref="/inbox" homeLabel="Go to inbox" />;
}
