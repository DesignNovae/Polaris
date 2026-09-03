import { safeDestination } from "@/lib/auth/redirect";
import { AuthShell } from "../../AuthShell";
import { SsoCallbackFlow } from "@/components/auth/SsoCallbackFlow";

export const metadata = {
  title: "Finishing sign-in",
  robots: { index: false, follow: false },
};

type SsoCallbackPageProps = {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

/**
 * Where Google (and any other OAuth provider) returns the user.
 *
 * This route did not exist: both flows pointed their `redirectUrl` at
 * `/signin/sso-callback` and `/signup/sso-callback`, which the `[[...rest]]`
 * catch-alls happily matched - so the callback rendered the sign-in form again
 * instead of completing the handshake, and social sign-in could never finish.
 */
export default async function SsoCallbackPage({ searchParams }: SsoCallbackPageProps) {
  const params = await searchParams;
  return (
    <AuthShell mode="task">
      <SsoCallbackFlow destination={safeDestination(params.redirect_url)} />
    </AuthShell>
  );
}
