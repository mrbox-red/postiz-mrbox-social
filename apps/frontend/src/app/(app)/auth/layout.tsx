import { getT } from '@gitroom/react/translation/get.translation.service.backend';

export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getT();

  return (
    <div className="bg-[#0b0f18] flex flex-1 p-[12px] gap-[12px] min-h-screen w-screen text-white">
      {/*<style>{`html, body {overflow-x: hidden;}`}</style>*/}
      <ReturnUrlComponent />
      <div className="flex flex-col py-[40px] px-[20px] flex-1 lg:w-[600px] lg:flex-none rounded-[12px] text-white p-[12px] bg-[#141a2b]">
        <div className="w-full max-w-[440px] mx-auto justify-center gap-[20px] h-full flex flex-col text-white">
          <LogoTextComponent />
          <div className="flex">{children}</div>
        </div>
      </div>
      <div className="flex-1 hidden lg:flex flex-col items-center justify-center gap-[28px] px-[40px]">
        <img
          src="/viralstarz-logo.png"
          alt="Viral Starz"
          className="w-[380px] max-w-[70%] h-auto"
        />
        <div className="text-center flex flex-col gap-[10px]">
          <div className="text-[18px] text-[#9aa3b6] max-w-[520px]">
            Il piano editoriale di Viral Starz: un calendario, tutti i brand,
            tutte le pagine. Carica, programma, pubblica.
          </div>
        </div>
      </div>
    </div>
  );
}
