param(
  [string]$SuperUser = "postgres",
  [string]$AppUser = "personal_job_agent",
  [string]$AppPassword = "personal_job_agent",
  [string]$Database = "personal_job_agent",
  [string]$HostName = "localhost",
  [int]$Port = 5432,
  [string]$PsqlPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $SuperUser) { $SuperUser = "postgres" }
if (-not $AppUser) { $AppUser = "personal_job_agent" }
if (-not $AppPassword) { $AppPassword = "personal_job_agent" }
if (-not $Database) { $Database = "personal_job_agent" }
if (-not $HostName) { $HostName = "localhost" }
if (-not $Port) { $Port = 5432 }

function Find-Psql {
  param([string]$ProvidedPath)
  if ($ProvidedPath -and (Test-Path -LiteralPath $ProvidedPath)) { return (Resolve-Path -LiteralPath $ProvidedPath).Path }
  $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "D:\PostgreSQL\bin\psql.exe",
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  $found = Get-ChildItem -Path "C:\Program Files\PostgreSQL","D:\PostgreSQL" -Recurse -Filter psql.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { return $found.FullName }
  throw "psql.exe not found. Install PostgreSQL client tools or pass -PsqlPath."
}

function Quote-Ident {
  param([string]$Value)
  return '"' + $Value.Replace('"', '""') + '"'
}

function Quote-Literal {
  param([string]$Value)
  return "'" + $Value.Replace("'", "''") + "'"
}

function Invoke-Psql {
  param(
    [string]$DatabaseName,
    [string[]]$Args
  )
  & $script:Psql -v ON_ERROR_STOP=1 -h $HostName -p $Port -U $SuperUser -d $DatabaseName @Args
  if ($LASTEXITCODE -ne 0) { throw "psql command failed with exit code $LASTEXITCODE" }
}

$script:Psql = Find-Psql -ProvidedPath $PsqlPath
Write-Host "Using psql: $script:Psql"
Write-Host "Target: ${HostName}:${Port}, database=$Database, app user=$AppUser"
$EscapedAppUser = [string]$AppUser -replace "'", "''"
$EscapedDatabase = [string]$Database -replace "'", "''"

if (-not $env:PGPASSWORD) {
  $secure = Read-Host "Enter PostgreSQL superuser password for '$SuperUser'" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$roleExists = [string]::Join("", @(& $script:Psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$EscapedAppUser';" -h $HostName -p $Port -U $SuperUser -d postgres)).Trim()
if ($LASTEXITCODE -ne 0) { throw "Failed to query roles. Check superuser password." }
if ($roleExists -eq "1") {
  Write-Host "Role already exists: $AppUser"
} else {
  $createRoleSql = "CREATE ROLE $(Quote-Ident $AppUser) WITH LOGIN PASSWORD $(Quote-Literal $AppPassword);"
  Invoke-Psql -DatabaseName "postgres" -Args @("-c", $createRoleSql)
  Write-Host "Created role: $AppUser"
}

$dbExists = [string]::Join("", @(& $script:Psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$EscapedDatabase';" -h $HostName -p $Port -U $SuperUser -d postgres)).Trim()
if ($LASTEXITCODE -ne 0) { throw "Failed to query databases." }
if ($dbExists -eq "1") {
  Write-Host "Database already exists: $Database"
} else {
  $createDbSql = "CREATE DATABASE $(Quote-Ident $Database) OWNER $(Quote-Ident $AppUser);"
  Invoke-Psql -DatabaseName "postgres" -Args @("-c", $createDbSql)
  Write-Host "Created database: $Database"
}

Invoke-Psql -DatabaseName $Database -Args @("-c", "ALTER DATABASE $(Quote-Ident $Database) OWNER TO $(Quote-Ident $AppUser);")
Invoke-Psql -DatabaseName "postgres" -Args @("-c", "ALTER ROLE $(Quote-Ident $AppUser) CREATEDB;")
Invoke-Psql -DatabaseName $Database -Args @("-c", "GRANT ALL PRIVILEGES ON DATABASE $(Quote-Ident $Database) TO $(Quote-Ident $AppUser);")
Invoke-Psql -DatabaseName $Database -Args @("-c", "GRANT USAGE, CREATE ON SCHEMA public TO $(Quote-Ident $AppUser);")
Invoke-Psql -DatabaseName $Database -Args @("-c", "ALTER SCHEMA public OWNER TO $(Quote-Ident $AppUser);")

$oldPassword = $env:PGPASSWORD
$env:PGPASSWORD = $AppPassword
try {
  & $script:Psql -v ON_ERROR_STOP=1 -h $HostName -p $Port -U $AppUser -d $Database -c "SELECT 1;" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Application user connection check failed." }
  Write-Host "Application user can connect successfully."
} finally {
  $env:PGPASSWORD = $oldPassword
}

Write-Host ""
Write-Host "Local PostgreSQL is ready."
Write-Host "Next steps:"
Write-Host "  npm run setup"
Write-Host "  npm run dev"
