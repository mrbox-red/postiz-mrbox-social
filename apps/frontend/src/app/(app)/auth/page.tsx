import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { cookies } from 'next/headers';
export const dynamic = 'force-dynamic';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import Link from 'next/link';
import { getT } from '@gitroom/react/translation/get.translation.service.backend';
import { LoginWithOidc } from '@gitroom/frontend/components/auth/login.with.oidc';
export const metadata: Metadata = {
  title: `Viral Starz Register`,
  description: '',
};
export default async function Auth(params: {searchParams: Promise<{provider: string}>}) {
  const t = await getT();
  if (process.env.DISABLE_REGISTRATION === 'true') {
    // Viral Starz: passa l'eventuale invito al controllo, così chi è
    // stato invitato vede il form anche con le registrazioni chiuse.
    const invite = (await cookies()).get('org')?.value;
    const canRegister = (
      await (
        await internalFetch(
          `/auth/can-register${
            invite ? `?org=${encodeURIComponent(invite)}` : ''
          }`
        )
      ).json()
    ).register;
    if (!canRegister && !(await params?.searchParams)?.provider) {
      return (
        <>
          <LoginWithOidc />
          <div className="text-center">
            {t('registration_is_disabled', 'Registration is disabled')}
            <br />
            <Link className="underline hover:font-bold" href="/auth/login">
              {t('login_instead', 'Login instead')}
            </Link>
          </div>
        </>
      );
    }
  }
  return <Register />;
}
