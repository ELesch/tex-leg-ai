# TexLegAI - Next.js Web Application

AI-powered tool for browsing, searching, and analyzing Texas Legislature bills.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: NextAuth.js v5
- **AI Integration**: Vercel AI SDK + OpenAI

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use Supabase)
- OpenAI API key

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# OpenAI
OPENAI_API_KEY="sk-..."
```

### 3. Set Up Database

Generate Prisma client and push schema:

```bash
npm run db:generate
npm run db:push
```

### 4. Migrate Existing Data

If you have existing bill data from the Python application:

```bash
npm run db:seed
# or
npx tsx scripts/migrate-data.ts
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
web/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/          # Main app pages
│   │   ├── bills/            # Bill browsing
│   │   │   └── [billId]/     # Bill details
│   │   ├── search/           # Advanced search
│   │   └── saved/            # Saved bills
│   ├── api/                  # API routes
│   │   ├── auth/
│   │   ├── bills/
│   │   ├── chat/
│   │   └── saved/
│   ├── layout.tsx
│   └── page.tsx
├── components/               # React components
│   ├── bills/
│   ├── chat/
│   ├── layout/
│   └── ui/                   # shadcn/ui components
├── hooks/                    # Custom React hooks
├── lib/                      # Utilities
│   ├── auth.ts
│   ├── db/
│   └── utils/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
│   └── migrate-data.ts
├── types/
└── public/
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript check |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test` | Run tests |

## Features

### Bill Browsing
- Search with keywords (supports AND, OR, NOT operators)
- Filter by bill type (House/Senate)
- Sort by bill number, description, or last action
- Pagination

### Bill Details
- Full bill text display
- Metadata (status, authors, subjects)
- Direct link to Texas Capitol website

### AI Chat
- Per-bill chat sessions
- GPT-4o powered responses
- Chat history persistence

### User Features
- Save bills to personal list
- Add notes to saved bills
- OAuth (Google, GitHub) and credential login

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills` | List bills with search/filter |
| GET | `/api/bills/[id]` | Get bill details |
| POST | `/api/chat` | Send chat message |
| GET | `/api/saved` | Get saved bills |
| POST | `/api/saved` | Save a bill |
| DELETE | `/api/saved` | Remove saved bill |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

Build the production bundle:

```bash
npm run build
npm run start
```

## Contributing

1. Create a feature branch
2. Make changes
3. Run `npm run lint` and `npm run type-check`
4. Submit a pull request

## License

Private - All rights reserved.
