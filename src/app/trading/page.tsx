import { redirect } from 'next/navigation';
export default function TradingPage() {
  redirect('/trading/(tabs)/tradehub');
  return null;
}
