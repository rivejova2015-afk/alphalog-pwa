import dynamic from 'next/dynamic';
const TradeHub = dynamic(() => import('@/components/tradehub/TradeHub'), { ssr: false });

export default function TradeHubTab() {
  return <TradeHub />;
}
