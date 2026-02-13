import dynamic from 'next/dynamic';
const JournalPT = dynamic(() => import('@/components/journal/JournalPT'), { ssr: false });

export default function JournalPTTab() {
  return <JournalPT />;
}
