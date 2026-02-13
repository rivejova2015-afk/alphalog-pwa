import dynamic from 'next/dynamic';
const Treasury = dynamic(() => import('@/components/treasury/Treasury'), { ssr: false });

export default function TreasuryTab() {
  return <Treasury />;
}
