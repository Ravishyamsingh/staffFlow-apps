# StaffFlow

StaffFlow is a mobile-first owner flow for requesting restaurant staff in plain language, reviewing the parsed booking, ranking matching partners, and confirming a dispatch.

The repository began as a Stitch design handoff. The runnable implementations now live in [`apps/mobile`](./apps/mobile) and [`apps/admin`](./apps/admin), while the original Stitch HTML and screenshots remain in [`stitch_staffflow_restaurant_staffing_app`](./stitch_staffflow_restaurant_staffing_app) as visual references.

## Run it

```bash
npm install
npm run mobile
npm run admin
```

Then open the Expo development build on Android/iOS. Configure `apps/mobile/.env` with the deployed API URL and Cognito mobile app-client ID. The mobile OTP screen uses the backend custom-auth endpoints; no demo credentials or local bypass are included.

Useful checks:

```bash
npm run mobile:typecheck
npm test
```

## What is wired

- Cognito-backed mobile OTP and admin email/password authentication with refreshable sessions.
- Bearer-authorized API calls for request creation, parsing, review updates, matching, confirmation, cancellation, partner management, scoring, logs, dashboard data, and request history.
- Backend parsing and matching results rendered in the mobile owner flow and admin panel; no frontend request or partner seed data is used at runtime.
- Multiple booking cards, missing-field follow-up prompts, live taxonomy/location choices, tap-to-correct field editors, count steppers, and review-gated confirmation.
- Score-traceable backend matching with explanations returned from the actual score components.

For the admin panel, copy [`apps/admin/.env.example`](./apps/admin/.env.example) to `apps/admin/.env.local` and set the public API/Cognito values. Never put AWS access keys, Gemini, Google, or session secrets in `NEXT_PUBLIC_*` variables. The clients can be built now, but production still requires the AWS user pool triggers, API authorizer, data resources, and authenticated staging smoke test described in [`backend/README.md`](./backend/README.md).

AWS deployment assets are included in [`backend/scripts/deploy-aws.ps1`](./backend/scripts/deploy-aws.ps1), [`amplify.yml`](./amplify.yml), and [`apps/mobile/eas.json`](./apps/mobile/eas.json). The backend deployment requires pre-created AWS resources; the admin panel can be hosted with Amplify, and the native mobile app is built/distributed with EAS while using the deployed API URL.

## Continuous deployment

GitHub Actions configuration is included under [`.github/workflows`](./.github/workflows):

- `ci.yml` validates mobile, admin, backend, and Serverless packaging on pushes and pull requests.
- `deploy-backend.yml` deploys the AWS backend from `main` using GitHub OIDC and a protected `production` environment.
- `mobile-eas.yml` builds production Android/iOS binaries on mobile changes. Store submission is opt-in through the `MOBILE_AUTO_SUBMIT` repository variable or the manual workflow input.

Connect the repository and `main` branch to AWS Amplify Hosting, select **My app is a monorepo**, and set the app root to `apps/admin`. Amplify reads [`amplify.yml`](./amplify.yml) and deploys `apps/admin`. Add only these browser-safe variables to Amplify: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AWS_REGION`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, and `NEXT_PUBLIC_COGNITO_CLIENT_ID`. Do not add backend deployment variables or AWS access keys to Amplify; Amplify reserves names beginning with `AWS`.

In GitHub, create a `production` environment with these secrets:

- `MY_AWS_DEPLOY_ROLE_ARN`: an AWS IAM role trusted by GitHub's OIDC provider.
- `GEMINI_API_KEY`: optional backend parser secret.
- `EXPO_TOKEN`: Expo/EAS programmatic access token.
- `SENTRY_AUTH_TOKEN`: optional Sentry organization token used to upload mobile source maps.

Add these GitHub `production` variables for backend/mobile deployment: `MY_AWS_REGION`, `DYNAMODB_TABLE_NAME`, `S3_BUCKET_NAME`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_MOBILE_CLIENT_ID`, `WEBSOCKET_API_ID`, `WEBSOCKET_API_ENDPOINT`, `ADMIN_ORIGIN`, `EXPO_ORIGIN`, `CORS_ORIGINS`, `GEMINI_MODEL`, `EXPO_PROJECT_ID`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, and `SENTRY_PROJECT`. Set `MOBILE_AUTO_SUBMIT=true` only after EAS store credentials and release policy are ready.

The AWS role should use a narrowly scoped trust policy for this repository's `main` branch/production environment and should not use long-lived AWS access keys in GitHub. Run `eas init` once in `apps/mobile`, then save the generated project ID as `EXPO_PROJECT_ID`.

## Stitch handoff inventory

| Stitch export | Implemented route/state |
|---|---|
| `splash_screen_mobile` | `app/index.tsx` |
| `language_selection_screen_mobile` | `app/language.tsx` |
| `mobile_login_screen_mobile` | `app/login.tsx` |
| `request_input_empty_state`, `request_input_filled_state` | `app/(tabs)/index.tsx` |
| `loading_parsing_state` | `app/loading.tsx` |
| `review_correct_flagged_fields`, `review_correct_all_resolved`, `review_correct_follow_up_question` | `app/review.tsx` |
| `top_5_partners_populated`, `top_5_partners_empty_state` | `app/partners.tsx` |
| `confirmation_success_screen` | `app/confirmation.tsx` |
| `my_requests_empty_state`, `my_requests_populated_state` | `app/(tabs)/my-requests.tsx` |
| `request_detail_slide_over` | Reference only; the owner app uses a native modal editor |
| `admin_login_screen` | `apps/admin/app/login/page.tsx` |
| `admin_dashboard` | `apps/admin/app/(admin)/dashboard/page.tsx` |
| `admin_live_requests_kanban` | `apps/admin/app/(admin)/requests/live/page.tsx` |
| `admin_request_detail_slide_over` | `apps/admin/src/components/request-detail-drawer.tsx` |

## Ten-request smoke results

The backend parser is designed around the supplied take-home cases. Clear requests produce a complete booking; ambiguous requests remain reviewable and show a flagged field instead of being silently confirmed.

| # | Expected local behavior |
|---|---|
| 1 | Two bookings: Chinese Chef ×2 and Kitchen Helper ×1; Saturday/time/location inherited and reviewable. |
| 2 | Tandoor Chef ×1; explicit date, 11:00–16:00, Rajouri Garden. |
| 3 | Deep Cleaning ×3; Sunday morning is inferred with lower time confidence. |
| 4 | Waiter ×1; 28 October start, date range noted by `dateEnd`, evening window, Karol Bagh. |
| 5 | Flags role, time, and location; follow-up questions are shown. |
| 6 | Chinese Chef ×2; Saturday/CP recognized; time remains flagged. |
| 7 | Chef recognized; date, time, and location remain flagged. |
| 8 | General Chef ×1, Lajpat Nagar, weekend date, budget note; time remains flagged. |
| 9 | Two bookings split into Chef ×2 Saturday and Cleaner ×1 Sunday at Saket. |
| 10 | Pastry Chef Friday; cancellation request is retained as a note because replacement/cancellation automation is out of scope. |

## Known limits and next seam

Payments, notifications, partner-side tooling, and cancellation/replacement automation are outside the current owner/admin launch scope. The backend parser can use the configured provider, while the mobile/admin clients consume its persisted results. See [`apps/mobile/DESIGN.md`](./apps/mobile/DESIGN.md) for the request schema and run an authenticated staging smoke test before launch.
