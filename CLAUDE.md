# TxLegAI - Texas Legislature Bill Analysis Platform

## Repository
- **GitHub**: https://github.com/ELesch/tex-leg-ai.git
- **Branch**: main
- **Deployment**: Vercel (https://web-pcl-bonding.vercel.app)

## Project Structure
```
TxLegAI/
├── web/                    # Next.js application
│   ├── app/               # App router pages and API routes
│   ├── components/        # React components
│   ├── lib/               # Utilities, database, auth
│   ├── prisma/            # Database schema and migrations
│   └── vercel.json        # Vercel deployment config
├── prompt_data/           # Screenshots and reference images
└── *.py                   # Python scripts for bill data processing
```

## Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS** with `tailwindcss-animate`
- **Radix UI** components (dropdown, dialog, tabs, toast, etc.)
- **Lucide React** icons
- **next-themes** for dark/light mode
- **Zustand** for state management
- **TanStack Query** for data fetching

### Backend
- **Next.js API Routes**
- **NextAuth.js v5** (beta) for authentication
- **Prisma** ORM with PostgreSQL
- **Zod** for validation

### AI Integration
- **Vercel AI SDK** (`ai` package)
- **Anthropic Claude** (`@anthropic-ai/sdk`)
- **OpenAI** (`@ai-sdk/openai`)
- **Google Gemini** (`@google/genai`)

### Testing
- **Vitest** for unit/integration tests
- **Testing Library** (React, Jest-DOM)

### Deployment
- **Vercel** (production)
- **Vercel CLI** available for deployments

## Common Commands

### Development
```bash
cd web
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript check
```

### Database
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

### Testing
```bash
npm run test         # Run tests
npm run test:ui      # Tests with UI
npm run test:coverage # Coverage report
```

### Deployment
```bash
cd web
vercel              # Preview deployment
vercel --prod       # Production deployment
vercel ls           # List deployments
vercel logs <url>   # View logs
```

### Post-Deployment Verification
**IMPORTANT:** After every deployment, always verify it succeeded:

1. **Check deployment status and timestamp:**
   ```bash
   cd web && vercel ls
   ```
   - Look for `● Ready` status on the latest deployment
   - `● Error` means it failed
   - The `Age` column shows when it was deployed (verify this matches your deploy time)

2. **If deployment shows Error:**
   ```bash
   # Use --prod to deploy manually and see full build output
   cd web && vercel --prod
   ```
   This shows the complete build log including any errors.

3. **Check runtime logs after deployment:**
   ```bash
   vercel logs <deployment-url> --follow
   ```
   Watch for any runtime errors when testing the deployed app.

4. **Verify the app is working:**
   - Visit https://web-pcl-bonding.vercel.app in browser
   - Test a key feature (e.g., navigate to a bill page)
   - Check browser console for any errors

## Key Files
- `web/components/bills/bill-detail.tsx` - Bill detail page with collapsible info panel
- `web/components/layout/header.tsx` - Main header with navigation and theme toggle
- `web/components/theme-switcher.tsx` - Dark/light/system theme toggle
- `web/components/providers.tsx` - App providers (auth, theme, query)
- `web/app/globals.css` - Global styles with CSS variables for theming
- `web/lib/db/prisma.ts` - Prisma client
- `web/lib/auth/auth.ts` - NextAuth configuration

## Environment Variables (Vercel)
Required in Vercel project settings:
- `DATABASE_URL` - PostgreSQL connection string (Supabase)
- `DIRECT_URL` - Direct Supabase connection (for migrations)
- `NEXTAUTH_SECRET` - Auth secret
- `NEXTAUTH_URL` - App URL
- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - OpenAI API key (optional)
- `GOOGLE_API_KEY` - Gemini API key (optional)

## Debugging

### Vercel CLI
Always run Vercel commands from the `web/` directory.

```bash
cd web

# List recent deployments and their status
vercel ls

# Deploy and watch build output (catches build errors)
vercel --prod

# Inspect a specific deployment
vercel inspect <deployment-url>

# View runtime logs for a deployment
vercel logs <deployment-url>

# View real-time logs (streaming)
vercel logs <deployment-url> --follow

# Check environment variables
vercel env ls

# Pull environment variables locally
vercel env pull .env.local
```

**Common deployment issues:**
- Build fails with 0ms duration = Usually missing env vars or immediate crash
- "Dynamic server usage" error = API route using `headers()` during static generation (add `export const dynamic = 'force-dynamic'`)
- Prisma errors = Run `prisma generate` in build command (already configured in vercel.json)

### Supabase (PostgreSQL Database)
Database is hosted on Supabase. Use Prisma for all database operations.

```bash
cd web

# Open Prisma Studio to browse/edit data
npm run db:studio

# Push schema changes to database (dev)
npm run db:push

# Create and run migrations (production-safe)
npm run db:migrate

# Generate Prisma client after schema changes
npm run db:generate

# Reset database (destructive - dev only)
npx prisma migrate reset
```

**Debugging database issues:**
1. Check connection: Verify `DATABASE_URL` is set correctly in Vercel env vars
2. Schema sync: Run `npm run db:push` if schema is out of sync
3. View data: Use `npm run db:studio` to inspect tables
4. Query logs: Add `log: ['query']` to Prisma client config temporarily

**Supabase Dashboard:**
- Access via Supabase project dashboard for:
  - SQL Editor (run raw queries)
  - Table Editor (view/edit data)
  - Logs (database connection logs)
  - Database settings (connection strings, pooling)

**Connection strings:**
- `DATABASE_URL` - Use pooled connection (port 6543) for app runtime
- `DIRECT_URL` - Use direct connection (port 5432) for migrations
