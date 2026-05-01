// =============================================================================
// src/types/supabase.ts
// GENERATED FILE — do not edit manually.
//
// Regenerate after every migration with:
//   supabase gen types typescript --local > src/types/supabase.ts
//
// This file exports only Database and Json.
// All helper types (Tables<>, InsertDto<>, UpdateDto<>, Enums<>) live in
// src/types/database.ts so they are never overwritten by regeneration.
// =============================================================================

// Placeholder until `supabase gen types typescript` is run against the live schema.
// Replace the entire contents of this file with the generated output.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
