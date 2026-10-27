# StaffFlow Admin

Next.js App Router implementation of the admin Stitch handoff. It follows the dark operations sidebar, dense KPI dashboard, heatmap, request feed, Kanban workflow, and request detail slide-over shown in the supplied admin screenshots.

## Run

From the repository root:

```bash
npm install
copy apps\admin\.env.example apps\admin\.env.local
npm run admin
```

Open `http://localhost:3000`. Sign in with a Cognito user from the configured user pool. The browser stores only the Cognito session and sends the Cognito ID token as a Bearer token to the StaffFlow API.

## Routes

- `/login` — two-panel admin login, forgot-password, error, and loading states.
- `/dashboard` — KPI cards, recent request feed, partner availability heatmap, subcategory demand, parse corrections donut.
- `/requests/live` — five-column drag-and-drop Kanban with filters and the request detail slide-over.
- `/requests/history` — searchable request table with detail drawer.
- `/partners` — searchable partner grid and add-partner modal.
- `/subcategories`, `/locations`, `/ai-parse-log`, `/scoring-config`, `/settings` — operational database and system surfaces from the admin prompt.

## Environment safety

`.env.example` and `.env.local.example` are templates only. There are no real credentials in this repository. Browser-visible variables are limited to the app name, API base URL, AWS region, Cognito user-pool ID, and Cognito app-client ID. Never commit AWS access keys or backend secrets. The admin API client uses `NEXT_PUBLIC_API_BASE_URL` and the Cognito client settings at runtime.

The dashboard, request workflow, partner management, taxonomy, parse logs, scoring configuration, and settings pages call the authenticated API routes directly. Configure the API base URL and Cognito app client before starting the panel; an empty backend returns empty states rather than seeded records.
