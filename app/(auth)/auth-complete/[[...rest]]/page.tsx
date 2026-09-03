import { AuthCompleteFlow } from "@/components/auth/AuthCompleteFlow";
import { safeDestination } from "@/lib/auth/redirect";

type AuthCompletePageProps = {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export default async function AuthCompletePage({ searchParams }: AuthCompletePageProps) {
  const query = await searchParams;
  return <AuthCompleteFlow destination={safeDestination(query.redirect_url)} />;
}
