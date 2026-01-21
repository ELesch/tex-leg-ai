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
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auth secret
- `NEXTAUTH_URL` - App URL
- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - OpenAI API key (optional)
- `GOOGLE_API_KEY` - Gemini API key (optional)
