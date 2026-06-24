# Apply migration 0042 (moksilgi_monthly_records performance index) to remote Supabase.
# Requires one of:
#   - SUPABASE_DB_URL in .env.local (Session pooler URI, percent-encoded password)
#   - SUPABASE_ACCESS_TOKEN in .env.local (+ optional SUPABASE_PROJECT_REF)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
$migrationFile = Join-Path $root "supabase/migrations/0042_add_moksilgi_records_performance_index.sql"
$verifySql = @"
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_moksilgi_monthly_records_plan_year_month';
"@

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return
  }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      if (-not [string]::IsNullOrWhiteSpace($name)) {
        Set-Item -Path "env:$name" -Value $value
      }
    }
  }
}

function Get-ProjectRef {
  if ($env:SUPABASE_PROJECT_REF) {
    return $env:SUPABASE_PROJECT_REF
  }
  $url = $env:NEXT_PUBLIC_SUPABASE_URL
  if ($url -match 'https://([^.]+)\.supabase\.co') {
    return $matches[1]
  }
  throw "Could not resolve project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL."
}

Import-DotEnv -Path $envFile

if (-not (Test-Path $migrationFile)) {
  throw "Migration file not found: $migrationFile"
}

Write-Host "Applying migration 0042..."

if ($env:SUPABASE_ACCESS_TOKEN) {
  supabase login --token $env:SUPABASE_ACCESS_TOKEN | Out-Null
  $projectRef = Get-ProjectRef
  if (-not (Test-Path (Join-Path $root "supabase/config.toml"))) {
    supabase init --force --workdir $root | Out-Null
  }
  supabase link --project-ref $projectRef --workdir $root --yes 2>&1 | Out-Host
  supabase db query --linked --workdir $root -f $migrationFile
  Write-Host "Verifying index..."
  supabase db query --linked --workdir $root $verifySql
  exit $LASTEXITCODE
}

if ($env:SUPABASE_DB_URL) {
  supabase db query --db-url $env:SUPABASE_DB_URL -f $migrationFile
  Write-Host "Verifying index..."
  supabase db query --db-url $env:SUPABASE_DB_URL $verifySql
  exit $LASTEXITCODE
}

Write-Error @"
Missing database credentials.

Add ONE of the following to .env.local, then re-run:
  SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
  SUPABASE_ACCESS_TOKEN=<personal access token from https://supabase.com/dashboard/account/tokens>

Or run the SQL in Supabase Dashboard > SQL Editor:
  $migrationFile
"@
