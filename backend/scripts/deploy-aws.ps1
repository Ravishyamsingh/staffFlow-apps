[CmdletBinding()]
param(
  [string]$Stage = "prod",
  [string]$Region = "ap-south-1",
  [Parameter(Mandatory = $true)] [string]$AccountId,
  [Parameter(Mandatory = $true)] [string]$DynamoTableName,
  [Parameter(Mandatory = $true)] [string]$S3BucketName,
  [Parameter(Mandatory = $true)] [string]$CognitoUserPoolId,
  [Parameter(Mandatory = $true)] [string]$CognitoClientId,
  [Parameter(Mandatory = $true)] [string]$CognitoMobileClientId,
  [Parameter(Mandatory = $true)] [string]$WebsocketApiId,
  [Parameter(Mandatory = $true)] [string]$AdminOrigin,
  [string]$ExpoOrigin = "http://localhost:8081",
  [string]$WebsocketApiEndpoint = "",
  [string]$GeminiModel = "gemini-2.0-flash",
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. Install it and reopen PowerShell before deploying."
  }
}

function Assert-AwsResource([string]$Label, [scriptblock]$Check) {
  try {
    $output = & $Check 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ($output -join " ")
    }
  } catch {
    throw "$Label is not reachable in AWS. Verify the identifier, region, and permissions. $($_.Exception.Message)"
  }
}

Require-Command "aws"
Require-Command "npm"

if ([string]::IsNullOrWhiteSpace($WebsocketApiEndpoint)) {
  $WebsocketApiEndpoint = "https://$WebsocketApiId.execute-api.$Region.amazonaws.com/$Stage"
}

$env:AWS_REGION = $Region
$env:AWS_ACCOUNT_ID = $AccountId
$env:DYNAMODB_TABLE_NAME = $DynamoTableName
$env:S3_BUCKET_NAME = $S3BucketName
$env:COGNITO_USER_POOL_ID = $CognitoUserPoolId
$env:COGNITO_CLIENT_ID = $CognitoClientId
$env:COGNITO_MOBILE_CLIENT_ID = $CognitoMobileClientId
$env:COGNITO_ISSUER_URL = "https://cognito-idp.$Region.amazonaws.com/$CognitoUserPoolId"
$env:WEBSOCKET_API_ID = $WebsocketApiId
$env:WEBSOCKET_API_ENDPOINT = $WebsocketApiEndpoint
$env:WS_CONNECTIONS_TABLE_NAME = $DynamoTableName
$env:ADMIN_ORIGIN = $AdminOrigin
$env:EXPO_ORIGIN = $ExpoOrigin
$env:CORS_ORIGINS = "$AdminOrigin,$ExpoOrigin"
$env:GEMINI_MODEL = $GeminiModel

if (-not $SkipChecks) {
  Write-Host "Checking AWS identity..." -ForegroundColor Cyan
  aws sts get-caller-identity --output table
  if ($LASTEXITCODE -ne 0) { throw "AWS identity check failed." }

  Write-Host "Checking required AWS resources..." -ForegroundColor Cyan
  $tableJson = aws dynamodb describe-table --table-name $DynamoTableName --region $Region --output json 2>&1
  if ($LASTEXITCODE -ne 0) { throw "DynamoDB table '$DynamoTableName' could not be described. $($tableJson -join ' ')" }
  $tableDescription = ($tableJson -join [Environment]::NewLine) | ConvertFrom-Json
  $indexNames = @($tableDescription.Table.GlobalSecondaryIndexes | ForEach-Object { $_.IndexName })
  foreach ($requiredIndex in @("GSI1", "GSI2", "GSI3")) {
    if ($indexNames -notcontains $requiredIndex) {
      throw "DynamoDB table '$DynamoTableName' is missing required index '$requiredIndex'."
    }
  }
  Assert-AwsResource "S3 bucket '$S3BucketName'" { aws s3api head-bucket --bucket $S3BucketName --region $Region }
  Assert-AwsResource "Cognito user pool '$CognitoUserPoolId'" { aws cognito-idp describe-user-pool --user-pool-id $CognitoUserPoolId --region $Region }
  Assert-AwsResource "Cognito web app client '$CognitoClientId'" { aws cognito-idp describe-user-pool-client --user-pool-id $CognitoUserPoolId --client-id $CognitoClientId --region $Region }
  Assert-AwsResource "Cognito mobile app client '$CognitoMobileClientId'" { aws cognito-idp describe-user-pool-client --user-pool-id $CognitoUserPoolId --client-id $CognitoMobileClientId --region $Region }
  Assert-AwsResource "WebSocket API '$WebsocketApiId'" { aws apigatewayv2 get-api --api-id $WebsocketApiId --region $Region }

  Write-Host "Running repository checks..." -ForegroundColor Cyan
  Push-Location (Join-Path $PSScriptRoot "..")
  try {
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "Backend typecheck failed." }
    npm test
    if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Backend build failed." }
    Write-Host "Packaging Serverless service..." -ForegroundColor Cyan
    npm exec -- serverless package --stage $Stage --region $Region
    if ($LASTEXITCODE -ne 0) { throw "Serverless packaging failed." }
  } finally {
    Pop-Location
  }
}

Write-Host "Deploying StaffFlow backend to AWS ($Region / $Stage)..." -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot "..")
try {
  npm exec -- serverless deploy --stage $Stage --region $Region --verbose
  if ($LASTEXITCODE -ne 0) { throw "Serverless deployment failed." }
  npm exec -- serverless info --stage $Stage --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Unable to read Serverless deployment info." }
} finally {
  Pop-Location
}

Write-Host "Deployment completed. Set EXPO_PUBLIC_API_BASE_URL to the HTTP API URL shown above." -ForegroundColor Green
