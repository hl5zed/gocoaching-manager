"use client";

import type { AdminCountrySummary } from "@/lib/api/admin/countries";
import type {
  AdminLookupSummary,
  AdminOrganizationSummary,
} from "@/lib/api/admin/users";

export type AdminUserGenerationOption = {
  generation_number: number;
  label: string;
};

export type AdminUsersOptionsPayload = {
  options: {
    countries: AdminCountrySummary[];
    regions: AdminLookupSummary[];
    organizations: AdminOrganizationSummary[];
    churches: AdminLookupSummary[];
    groups: AdminLookupSummary[];
    generations: AdminUserGenerationOption[];
  };
  optionErrors?: {
    countries?: string | null;
    regions?: string | null;
    organizations?: string | null;
    churches?: string | null;
    groups?: string | null;
  };
};

let cachedOptionsPayload: AdminUsersOptionsPayload | null = null;
let optionsPromise: Promise<AdminUsersOptionsPayload> | null = null;

export async function loadAdminUsersOptions() {
  if (cachedOptionsPayload) return cachedOptionsPayload;
  if (optionsPromise) return optionsPromise;

  optionsPromise = fetch("/api/admin/users/options", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("options request failed");
      }

      cachedOptionsPayload = (await response.json()) as AdminUsersOptionsPayload;
      return cachedOptionsPayload;
    })
    .finally(() => {
      optionsPromise = null;
    });

  return optionsPromise;
}
