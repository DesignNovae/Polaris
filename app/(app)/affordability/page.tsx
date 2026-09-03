/**
 * /affordability - can this family actually pay for this university?
 *
 * Server page: resolves the session and seeds the country from the student's
 * profile so the planner opens on something relevant rather than a blank form.
 */

import { requireSession } from "@/lib/authz";
import { getProfile } from "@/lib/db/collections";
import { supportedCountries } from "@/lib/affordability/model";
import { AffordabilityClient } from "@/components/app/AffordabilityClient";

export const metadata = { title: "Affordability" };
export const dynamic = "force-dynamic";

export default async function AffordabilityPage() {
  const user = await requireSession();
  const profile = await getProfile(user.id);
  const countries = supportedCountries();

  // Seed from the student's target country when we model it; otherwise the
  // most common destination in this market.
  const target = profile?.country;
  const defaultCountry =
    target && countries.includes(target) ? target : "USA";

  return (
    <AffordabilityClient countries={countries} defaultCountry={defaultCountry} />
  );
}
