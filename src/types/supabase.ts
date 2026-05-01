// =============================================================================
// src/types/supabase.ts
// GENERATED FILE - do not edit manually.
//
// Regenerate after every migration with:
//   supabase gen types typescript --local > src/types/supabase.ts
//
// This placeholder keeps Phase 0 typecheck working until generated types exist.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
