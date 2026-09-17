export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { AgentAiComponent } from '@gitroom/frontend/components/report/agent.ai.component';
export const metadata: Metadata = {
  title: 'Viral Starz - Agent',
  description: '',
};
export default async function Page() {
  return <AgentAiComponent />;
}
