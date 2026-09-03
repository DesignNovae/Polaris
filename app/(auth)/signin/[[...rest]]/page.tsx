import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { safeDestination } from "@/lib/auth/redirect";
import { AuthShell } from "../../AuthShell";
import { SignInFlow } from "@/components/auth/SignInFlow";

export const metadata = { title: "Sign in" };

type SignInPageProps = {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [{ userId }, params] = await Promise.all([auth(), searchParams]);
  const destination = safeDestination(params.redirect_url, "/roadmap");

  // Already signed in - never show the form again, just go where they meant to.
  if (userId) redirect(destination);

  // `destination` is resolved here and passed down rather than read with
  // useSearchParams in the client. That removes the Suspense boundary this page
  // used to need - and with it React's hidden streaming placeholder, which was
  // duplicating `id="clerk-captcha"` into the DOM and stopping Clerk's bot
  // protection from ever issuing a token.
  return (
    <AuthShell mode="signin">
      <SignInFlow destination={destination} />
    </AuthShell>
  );
}
