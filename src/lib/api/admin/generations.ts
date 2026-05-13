import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type AdminGenerationOption = {
  id: string;
  generation_number: number;
  label: string;
  scope_type: string;
  scope_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AdminGenerationOptionsResult = {
  generations: AdminGenerationOption[];
  error: string | null;
};

type GenerationOptionRow = AdminGenerationOption & {
  deleted_at?: string | null;
};

export async function getAdminGenerationOptions(): Promise<AdminGenerationOptionsResult> {
  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      generations: [],
      error: clientError ?? "세대 옵션 조회를 위한 서버 설정이 없습니다.",
    };
  }

  const { data, error } = await client
    .from("generation_options")
    .select(
      "id, generation_number, label, scope_type, scope_id, is_active, sort_order, created_at, updated_at",
    )
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("generation_number", { ascending: true });

  if (error) {
    console.error("[ADMIN_GENERATIONS_LOOKUP_FAILED]", error.message);
    return {
      generations: [],
      error: "세대 옵션을 불러오지 못했습니다.",
    };
  }

  return {
    generations: ((data ?? []) as GenerationOptionRow[]).map((generation) => ({
      id: generation.id,
      generation_number: generation.generation_number,
      label: generation.label,
      scope_type: generation.scope_type,
      scope_id: generation.scope_id,
      is_active: generation.is_active !== false,
      sort_order: generation.sort_order,
      created_at: generation.created_at,
      updated_at: generation.updated_at,
    })),
    error: null,
  };
}

export async function getActiveGlobalGenerationOptions() {
  const { client } = createSupabaseServiceClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("generation_options")
    .select("id, generation_number, label, sort_order")
    .eq("scope_type", "global")
    .is("scope_id", null)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("generation_number", { ascending: true });

  if (error) {
    console.error("[INVITATION_GENERATIONS_LOOKUP_FAILED]", error.message);
    return [];
  }

  return (data ?? []) as Array<{
    id: string;
    generation_number: number;
    label: string;
    sort_order: number;
  }>;
}
