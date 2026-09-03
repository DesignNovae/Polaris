import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { safeDestination } from "@/lib/auth/redirect";
import { AuthShell } from "../../AuthShell";
import { SignUpFlow } from "@/components/auth/SignUpFlow";

export const metadata = { title: "Create your account" };

type SignUpPageProps = {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const [{ userId }, params] = await Promise.all([auth(), searchParams]);
  const destination = safeDestination(params.redirect_url, "/roadmap?welcome=1");

  if (userId) redirect(destination);

  // No Suspense boundary here - see the note in the sign-in page. The captcha
  // container must exist exactly once in the document.
  return (
    <AuthShell mode="signup">
      <SignUpFlow destination={destination} />
    </AuthShell>
  );
}
