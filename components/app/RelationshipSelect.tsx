"use client";

/**
 * RelationshipSelect - PremiumSelect inside the server-rendered invite form.
 * Holds its own state and posts via a hidden input so the form action keeps
 * receiving `relationship` exactly as before.
 */

import { useState } from "react";
import { PremiumSelect } from "@/components/ui/PremiumSelect";

export function RelationshipSelect() {
  const [value, setValue] = useState("parent");
  return (
    <>
      <input type="hidden" name="relationship" value={value} />
      <PremiumSelect
        value={value}
        onChange={setValue}
        variant="input"
        align="right"
        className="w-[170px] shrink-0"
        options={[
          { value: "parent", label: "Parent", description: "Read-only progress view" },
          { value: "partner", label: "Partner / counselor", description: "Progress + notes access" },
        ]}
      />
    </>
  );
}

