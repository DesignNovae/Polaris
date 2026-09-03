import { AuthShell } from "../AuthShell";
import { SignOutFlow } from "@/components/auth/SignOutFlow";

export const metadata = { title: "Signing out" };

export default function SignOutPage() {
  return (
    <AuthShell mode="signout">
      <SignOutFlow />
    </AuthShell>
  );
}
