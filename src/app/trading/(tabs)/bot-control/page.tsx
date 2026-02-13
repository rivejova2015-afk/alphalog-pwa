import dynamic from 'next/dynamic';
const BotControl = dynamic(() => import('@/components/tradehub/BotControl'), { ssr: false });

export default function BotControlTab() {
  return <BotControl />;
}
