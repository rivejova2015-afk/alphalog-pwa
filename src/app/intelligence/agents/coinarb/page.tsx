import CoinarbDashboard from "@/components/coinarb/CoinarbDashboard.client";

export const dynamic = "force-dynamic";

export default function CoinarbPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <CoinarbDashboard />
    </div>
  );
}
