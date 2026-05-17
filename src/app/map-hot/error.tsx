"use client";

import { ErrorBoundaryPage } from "@/components/ui/error-boundary-page";

export default function MapHotError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryPage {...props} scope="map-hot" homeHref="/map-hot/goals" homeLabel="Go to goals" />;
}
