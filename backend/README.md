# StaffFlow backend

This package contains the deployable AWS Lambda/API Gateway backend for the mobile owner flow and the admin panel.

## Runtime contract

The HTTP Lambda is `src/handlers/http.handler`. API Gateway should expose:

- `GET /health` without authentication.
- `POST /api/auth/otp/send` and `POST /api/auth/otp/verify` for the optional mobile CUSTOM_AUTH OTP flow.
- Authenticated `POST|GET|PUT|PATCH|DELETE /api/*` routes with a Cognito JWT authorizer.

The JWT audience must include both the web and mobile Cognito app client IDs. The issuer must be:

```text
https://cognito-idp.ap-south-1.amazonaws.com/<user-pool-id>
```

The Lambda reads Cognito groups from `cognito:groups` and recognizes:

- `admin`: all administrative operations.
- `operation`: requests, partners, parsing logs, dashboard and matching operations.
- `owner`: own requests, parsing, confirmation and partner matching.
- `partner`: own partner profile and requests assigned to that partner.

## Routes

Core routes are implemented under `/api`:

```text
GET    /health
GET    /api/me
POST   /api/requests
GET    /api/requests
GET    /api/requests/:id
PATCH  /api/requests/:id
POST   /api/requests/:id/parse
GET    /api/requests/:id/matches
PUT    /api/requests/:id/confirm
PUT    /api/requests/:id/cancel
PUT    /api/requests/:id/complete
PUT    /api/requests/:id/assign
GET    /api/partners
POST   /api/partners
GET    /api/partners/:id
PATCH  /api/partners/:id
DELETE /api/partners/:id
GET    /api/subcategories
POST   /api/subcategories
PUT    /api/subcategories/:id
DELETE /api/subcategories/:id
GET    /api/locations
POST   /api/locations
PUT    /api/locations/:id
DELETE /api/locations/:id
GET    /api/parse-logs
GET    /api/parse-logs/:requestId
GET    /api/scoring/config
PUT    /api/scoring/config
POST   /api/scoring/preview
GET    /api/dashboard/stats
GET    /api/dashboard/heatmap
POST   /api/storage/presign-upload
POST   /api/storage/presign-download
```

## Deploy

The deployment expects these AWS resources to exist first: a DynamoDB table with the primary key and three GSIs described below, a private S3 bucket, a Cognito user pool with web/mobile app clients, and a WebSocket API. The deployment script validates the local build and then runs Serverless; it does not silently create or replace those resources.

Install/configure the AWS CLI and verify the account before deploying:

```powershell
aws configure sso
aws sts get-caller-identity
```

For a new environment, create the external resources once before the application
deployment. The repository includes the exact DynamoDB key/index definition at
[`infrastructure/dynamodb-create-table.json`](./infrastructure/dynamodb-create-table.json):

```powershell
aws dynamodb create-table --cli-input-json file://backend/infrastructure/dynamodb-create-table.json --region ap-south-1
aws dynamodb wait table-exists --table-name StaffFlow --region ap-south-1

aws s3api create-bucket --bucket staffflow-private-prod --region ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1
aws s3api put-public-access-block --bucket staffflow-private-prod --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket staffflow-private-prod --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws apigatewayv2 create-api --name staffflow-prod --protocol-type WEBSOCKET --route-selection-expression '$request.body.action' --region ap-south-1
```

Create the Cognito user pool and two app clients in the same region before the
backend deployment. The admin client should have no client secret and use the
standard password flow. The mobile client should have no client secret and enable
`ALLOW_CUSTOM_AUTH` plus refresh tokens. Add the `owner`, `admin`, `operation`,
and `partner` groups used by the API. Save the pool ID, both client IDs, and the
WebSocket API ID for the deployment command below.

Do not put AWS access keys in Lambda environment variables. Serverless uses the local AWS profile/SSO session to deploy, while Lambda receives AWS permissions through its execution role. Keep `GEMINI_API_KEY` out of source control and provide it only through the deployment shell or CI secret store.

```powershell
$env:MY_AWS_REGION = "ap-south-1"
$env:MY_AWS_ACCOUNT_ID = "123456789012"
$env:DYNAMODB_TABLE_NAME = "StaffFlow"
$env:S3_BUCKET_NAME = "your-private-bucket"
$env:COGNITO_USER_POOL_ID = "ap-south-1_xxxxxxxx"
$env:COGNITO_CLIENT_ID = "your-admin-client-id"
$env:COGNITO_MOBILE_CLIENT_ID = "your-mobile-client-id"
$env:COGNITO_ISSUER_URL = "https://cognito-idp.ap-south-1.amazonaws.com/$env:COGNITO_USER_POOL_ID"
$env:WEBSOCKET_API_ID = "your-existing-websocket-api-id"
$env:WEBSOCKET_API_ENDPOINT = "https://<websocket-api-id>.execute-api.ap-south-1.amazonaws.com/prod"
$env:ADMIN_ORIGIN = "https://admin.example.com"
$env:EXPO_ORIGIN = "http://localhost:8081"
$env:CORS_ORIGINS = "$env:ADMIN_ORIGIN,$env:EXPO_ORIGIN"

npm run backend:typecheck
npm run backend:test
npm run backend:build
npm run backend:deploy -- -Stage prod -Region ap-south-1 -AccountId 123456789012 -DynamoTableName StaffFlow -S3BucketName staffflow-private-prod -CognitoUserPoolId ap-south-1_xxxxxxxx -CognitoClientId your-admin-client-id -CognitoMobileClientId your-mobile-client-id -WebsocketApiId your-existing-websocket-api-id -AdminOrigin https://admin.example.com -ExpoOrigin http://localhost:8081
```

The script is [`scripts/deploy-aws.ps1`](./scripts/deploy-aws.ps1). It sets the project-owned `MY_AWS_*` deployment environment for the current process, runs typecheck/tests/build/package, deploys the stack, and prints the API endpoints. Pass `-SkipChecks` only for an emergency code-only redeploy.

After deployment, configure the three Cognito custom-auth triggers with the deployed Lambda ARNs and grant Cognito permission to invoke them. The mobile client must have `ALLOW_CUSTOM_AUTH`; the admin client should use the standard password flow. Cognito custom-auth and app-client flow settings are described in the AWS documentation linked from the project deployment notes.

The three Cognito custom-auth trigger handlers are packaged as `defineAuthChallenge`,
`createAuthChallenge`, and `verifyAuthChallenge`. Attach those deployed Lambda ARNs to
the existing User Pool under Define auth challenge, Create auth challenge, and Verify
auth challenge response. Do this only if the mobile app client is configured with
`CUSTOM_AUTH`; the standard admin email/password flow does not use these triggers.
The trigger role needs `sns:Publish` and the account must have SMS messaging enabled.

The existing DynamoDB table must contain `PK` and `SK` keys and the `GSI1`, `GSI2`, and `GSI3` indexes described in `tech-stack.md`. WebSocket connection records use the same table by default (`WS_CONNECTIONS_TABLE_NAME=StaffFlow`); set a separate existing table name if you prefer. The Lambda role needs access to the table and all indexes, the private S3 bucket, CloudWatch logs, and API Gateway WebSocket management.

## Frontend integration

The mobile owner flow and admin panel now use the routes above. Both clients obtain Cognito sessions, attach the Cognito ID token as `Authorization: Bearer <token>`, refresh sessions when they expire, and render backend responses instead of seeded request/partner records. The mobile OTP screen calls `/api/auth/otp/send` and `/api/auth/otp/verify`; attach the custom-auth triggers to the user pool before enabling that flow in production.

## GitHub Actions deployment

The repository's `deploy-backend.yml` workflow deploys this service after a push
to `main` that changes the backend, package manifests, or the workflow itself.
It runs [`scripts/deploy-aws.sh`](./scripts/deploy-aws.sh) on Ubuntu and expects
the AWS resource names and Cognito IDs as GitHub `production` environment
variables. Store only `MY_AWS_DEPLOY_ROLE_ARN` and `GEMINI_API_KEY` as secrets.

Configure GitHub's OIDC provider in IAM and restrict the assumed role trust
policy to this repository and its `production` environment. The workflow uses
short-lived AWS credentials through `aws-actions/configure-aws-credentials`; it
does not require AWS access keys in GitHub.
