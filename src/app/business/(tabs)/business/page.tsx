import dynamic from 'next/dynamic';
const Business = dynamic(() => import('@/components/business/Business'), { ssr: false });

export default function BusinessTab() {
  return <Business />;
}
