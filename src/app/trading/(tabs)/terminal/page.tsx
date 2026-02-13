import dynamic from 'next/dynamic';
const Terminal = dynamic(() => import('@/components/terminal/Terminal'), { ssr: false });

export default function TerminalTab() {
  return <Terminal />;
}
