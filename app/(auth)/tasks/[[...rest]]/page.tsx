import { AuthTaskFlow } from "@/components/auth/AuthTaskFlow";
import { safeDestination } from "@/lib/auth/redirect";

type TaskKey = "choose-organization" | "reset-password" | "setup-mfa";

type TaskPageProps = {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

function isTaskKey(value: string | undefined): value is TaskKey {
  return value === "choose-organization" || value === "reset-password" || value === "setup-mfa";
}

export default async function AuthTaskPage({ params, searchParams }: TaskPageProps) {
  const [{ rest }, query] = await Promise.all([params, searchParams]);
  const task = rest?.[0];

  return (
    <AuthTaskFlow
      task={isTaskKey(task) ? task : null}
      destination={safeDestination(query.redirect_url)}
    />
  );
}
