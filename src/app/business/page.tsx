import { redirect } from 'next/navigation';
export default function BusinessPage() {
  redirect('/business/operations');
  return null;
}
