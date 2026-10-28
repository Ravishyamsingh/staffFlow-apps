#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

: "${MY_AWS_REGION:=ap-south-1}"
: "${STAGE:=prod}"
: "${DYNAMODB_TABLE_NAME:?DYNAMODB_TABLE_NAME is required}"
: "${S3_BUCKET_NAME:?S3_BUCKET_NAME is required}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID is required}"
: "${COGNITO_CLIENT_ID:?COGNITO_CLIENT_ID is required}"
: "${COGNITO_MOBILE_CLIENT_ID:?COGNITO_MOBILE_CLIENT_ID is required}"
: "${COGNITO_OAUTH_CLIENT_ID:=${COGNITO_MOBILE_CLIENT_ID}}"
: "${WEBSOCKET_API_ID:?WEBSOCKET_API_ID is required}"
: "${ADMIN_ORIGIN:?ADMIN_ORIGIN is required}"

export MY_AWS_REGION STAGE DYNAMODB_TABLE_NAME S3_BUCKET_NAME
export COGNITO_USER_POOL_ID COGNITO_CLIENT_ID COGNITO_MOBILE_CLIENT_ID COGNITO_OAUTH_CLIENT_ID
export WEBSOCKET_API_ID ADMIN_ORIGIN

command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }

export MY_AWS_ACCOUNT_ID="${MY_AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
export COGNITO_ISSUER_URL="${COGNITO_ISSUER_URL:-https://cognito-idp.${MY_AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}}"
export WEBSOCKET_API_ENDPOINT="${WEBSOCKET_API_ENDPOINT:-https://${WEBSOCKET_API_ID}.execute-api.${MY_AWS_REGION}.amazonaws.com/${STAGE}}"
export WS_CONNECTIONS_TABLE_NAME="${WS_CONNECTIONS_TABLE_NAME:-$DYNAMODB_TABLE_NAME}"
export EXPO_ORIGIN="${EXPO_ORIGIN:-http://localhost:8081}"
export CORS_ORIGINS="${CORS_ORIGINS:-${ADMIN_ORIGIN},${EXPO_ORIGIN}}"
export GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.0-flash}"

echo "Checking AWS identity..."
aws sts get-caller-identity --output table

echo "Checking required AWS resources..."
aws dynamodb describe-table --table-name "$DYNAMODB_TABLE_NAME" --region "$MY_AWS_REGION" >/dev/null

indexes="$(aws dynamodb describe-table \
  --table-name "$DYNAMODB_TABLE_NAME" \
  --region "$MY_AWS_REGION" \
  --query 'Table.GlobalSecondaryIndexes[].IndexName' \
  --output text)"
for required_index in GSI1 GSI2 GSI3; do
  if ! printf '%s\n' "$indexes" | tr '\t' '\n' | grep -Fxq "$required_index"; then
    echo "DynamoDB table is missing required index: $required_index" >&2
    exit 1
  fi
done

aws s3api head-bucket --bucket "$S3_BUCKET_NAME" --region "$MY_AWS_REGION"
aws cognito-idp describe-user-pool --user-pool-id "$COGNITO_USER_POOL_ID" --region "$MY_AWS_REGION" >/dev/null
aws cognito-idp describe-user-pool-client --user-pool-id "$COGNITO_USER_POOL_ID" --client-id "$COGNITO_CLIENT_ID" --region "$MY_AWS_REGION" >/dev/null
aws cognito-idp describe-user-pool-client --user-pool-id "$COGNITO_USER_POOL_ID" --client-id "$COGNITO_MOBILE_CLIENT_ID" --region "$MY_AWS_REGION" >/dev/null
aws apigatewayv2 get-api --api-id "$WEBSOCKET_API_ID" --region "$MY_AWS_REGION" >/dev/null

cd "$REPO_ROOT/backend"
npm run typecheck
npm test
npm run build
npm exec -- serverless package --stage "$STAGE" --region "$MY_AWS_REGION"
npm exec -- serverless deploy --stage "$STAGE" --region "$MY_AWS_REGION" --verbose
npm exec -- serverless info --stage "$STAGE" --region "$MY_AWS_REGION"

echo "Backend deployment completed successfully."
