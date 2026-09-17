import { redirect } from 'next/navigation';

// Viral Starz: le vecchie conversazioni dell'agente Postiz non esistono più.
export default async function Page() {
  return redirect('/agents');
}
