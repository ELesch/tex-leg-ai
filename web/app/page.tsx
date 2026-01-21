import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, Search, MessageSquare, BookmarkIcon } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">TxLegAI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/bills">
              <Button variant="ghost">Browse Bills</Button>
            </Link>
            <Link href="/login">
              <Button>Sign In</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Texas Legislature
            <span className="text-primary"> Bill Analyzer</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            AI-powered tool for browsing, searching, and understanding Texas
            Legislature bills. Get instant insights and ask questions about any
            bill.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/bills">
              <Button size="lg" className="gap-2">
                <Search className="h-5 w-5" />
                Browse Bills
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Get Started
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t bg-muted/50 py-24">
          <div className="container">
            <h2 className="text-center text-3xl font-bold">Features</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {/* Feature 1 */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">Advanced Search</h3>
                <p className="mt-2 text-muted-foreground">
                  Search through thousands of bills using keywords, boolean
                  operators (AND, OR, NOT), and filters.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">AI Chat</h3>
                <p className="mt-2 text-muted-foreground">
                  Ask questions about any bill and get instant, accurate answers
                  powered by GPT-4.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BookmarkIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">Save & Track</h3>
                <p className="mt-2 text-muted-foreground">
                  Save bills to your personal list, add notes, and track changes
                  over time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24">
          <div className="container">
            <div className="grid gap-8 text-center md:grid-cols-3">
              <div>
                <div className="text-4xl font-bold text-primary">4,956</div>
                <div className="mt-2 text-muted-foreground">Bills Available</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary">89th</div>
                <div className="mt-2 text-muted-foreground">
                  Texas Legislature Session
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary">AI</div>
                <div className="mt-2 text-muted-foreground">
                  Powered Analysis
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TxLegAI. All rights reserved.</p>
          <p className="mt-2">
            Data sourced from the Texas Legislature public records.
          </p>
        </div>
      </footer>
    </div>
  );
}
