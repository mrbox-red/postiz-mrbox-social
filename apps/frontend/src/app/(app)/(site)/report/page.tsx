export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { ReportComponent } from '@gitroom/frontend/components/report/report.component';
export const metadata: Metadata = {
  title: `Viral Starz Report`,
  description: '',
};
export default async function Index() {
  return <ReportComponent />;
}
