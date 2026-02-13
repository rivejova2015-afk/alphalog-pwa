import dynamic from 'next/dynamic';
const TraderMap = dynamic(() => import('@/components/tradermap/TraderMap'), { ssr: false });

export default function TraderMapTab() {
  return <TraderMap />;
}
