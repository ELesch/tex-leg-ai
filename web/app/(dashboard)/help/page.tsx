import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  HelpCircle,
  Search,
  FileText,
  Users,
  ExternalLink,
  Bot,
} from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <h1 className="text-3xl font-bold">Help & Documentation</h1>
        <p className="mt-1 text-muted-foreground">
          Learn how to use TexLegAI to track and analyze Texas legislation
        </p>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-8">
        {/* Quick Links */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Searching Bills</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Learn how to search and filter bills using keywords, boolean operators, and advanced filters.
            </p>
            <Link href="#searching" className="text-sm text-primary hover:underline mt-2 inline-block">
              Learn more
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Assistant</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get help understanding bills with our AI-powered assistant that can analyze and explain legislation.
            </p>
            <Link href="#ai" className="text-sm text-primary hover:underline mt-2 inline-block">
              Learn more
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Team Collaboration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create teams to collaborate on bill analysis with shared workspaces and annotations.
            </p>
            <Link href="#teams" className="text-sm text-primary hover:underline mt-2 inline-block">
              Learn more
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <Card id="getting-started">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Getting Started</CardTitle>
          </div>
          <CardDescription>Quick start guide for new users</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="space-y-4">
            <li>
              <strong>Browse Bills</strong> - Visit the{' '}
              <Link href="/bills" className="text-primary hover:underline">
                Bills page
              </Link>{' '}
              to see all bills from the current legislative session. Use the search bar and filters to find specific bills.
            </li>
            <li>
              <strong>View Bill Details</strong> - Click on any bill to see its full text, authors, status, and history. You can use the AI assistant to help understand complex legislation.
            </li>
            <li>
              <strong>Save Bills</strong> - Click the bookmark icon on any bill to save it to your collection for quick access later.
            </li>
            <li>
              <strong>Create a Team</strong> - For collaborative analysis, create a team and invite colleagues to share workspaces, annotations, and AI chat sessions.
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Searching Bills */}
      <Card id="searching">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <CardTitle>Searching Bills</CardTitle>
          </div>
          <CardDescription>Master the search features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Basic Search</h4>
            <p className="text-sm text-muted-foreground">
              Enter keywords in the search box to find bills containing those terms in their description or content.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Boolean Operators</h4>
            <p className="text-sm text-muted-foreground">Use these operators for more precise searches:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li><code className="bg-muted px-1 rounded">AND</code> - Find bills containing all terms (e.g., &quot;education AND funding&quot;)</li>
              <li><code className="bg-muted px-1 rounded">OR</code> - Find bills containing any term (e.g., &quot;tax OR revenue&quot;)</li>
              <li><code className="bg-muted px-1 rounded">NOT</code> - Exclude bills with certain terms (e.g., &quot;healthcare NOT insurance&quot;)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Bill Number Search</h4>
            <p className="text-sm text-muted-foreground">
              Search directly by bill number using the format &quot;HB 1&quot; or &quot;SB 123&quot;.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Filters</h4>
            <p className="text-sm text-muted-foreground">
              Use the dropdown filters to narrow results by bill type (HB, SB, etc.), author, or sort order.
            </p>
          </div>

          <Link href="/search">
            <Button variant="outline" className="mt-2">
              <Search className="mr-2 h-4 w-4" />
              Try Advanced Search
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* AI Assistant */}
      <Card id="ai">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle>AI Assistant</CardTitle>
          </div>
          <CardDescription>Get help understanding legislation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Each bill page includes an AI chat assistant that can help you understand the legislation. You can ask questions like:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>&quot;Summarize this bill in simple terms&quot;</li>
            <li>&quot;What are the key provisions?&quot;</li>
            <li>&quot;Who would be affected by this bill?&quot;</li>
            <li>&quot;Are there any concerns or controversies?&quot;</li>
            <li>&quot;How does this compare to similar legislation?&quot;</li>
          </ul>

          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-semibold mb-2">Configuring Your AI Provider</h4>
            <p className="text-sm text-muted-foreground mb-2">
              You can use your own API key for AI features. Go to{' '}
              <Link href="/settings" className="text-primary hover:underline">
                Settings
              </Link>{' '}
              to configure your preferred AI provider (OpenAI, Anthropic, or Google).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Teams */}
      <Card id="teams">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Team Collaboration</CardTitle>
          </div>
          <CardDescription>Work together on bill analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Creating a Team</h4>
            <p className="text-sm text-muted-foreground">
              Go to the Teams section in the sidebar and click &quot;Create Team&quot; to start a new team. Give it a name and optional description.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Team Workspaces</h4>
            <p className="text-sm text-muted-foreground">
              Create workspaces for specific bills your team is tracking. Each workspace includes:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Shared bill annotations and highlights</li>
              <li>Team discussion comments</li>
              <li>Collaborative AI chat sessions</li>
              <li>Status tracking and priority settings</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Team Roles</h4>
            <p className="text-sm text-muted-foreground">Members can have different roles:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li><strong>Owner</strong> - Full control, can delete team</li>
              <li><strong>Admin</strong> - Can manage members and settings</li>
              <li><strong>Contributor</strong> - Can add and edit content</li>
              <li><strong>Reviewer</strong> - Can comment and annotate</li>
              <li><strong>Viewer</strong> - Read-only access</li>
            </ul>
          </div>

          <Link href="/teams/new">
            <Button variant="outline" className="mt-2">
              <Users className="mr-2 h-4 w-4" />
              Create a Team
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card id="faq">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            <CardTitle>Frequently Asked Questions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What bills are included in TexLegAI?</AccordionTrigger>
              <AccordionContent>
                TexLegAI includes all bills from the 89th Texas Legislature Regular Session (2025). This includes House Bills (HB), Senate Bills (SB), and various resolutions (HJR, SJR, HCR, SCR).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>How often is the data updated?</AccordionTrigger>
              <AccordionContent>
                Bill data is synchronized regularly from the Texas Legislature Online (TLO). Administrators can trigger manual syncs when needed. Check the admin dashboard for the last sync time.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Is my API key secure?</AccordionTrigger>
              <AccordionContent>
                Yes, your API key is encrypted before being stored in our database. It is only decrypted when needed to make API calls on your behalf. We never log or expose your API key.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>Can I use TexLegAI without an AI provider key?</AccordionTrigger>
              <AccordionContent>
                Yes! You can browse bills, save them, and use team collaboration features without configuring an AI provider. The AI chat feature requires either your own API key or a team with a shared key.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>How do I report a bug or request a feature?</AccordionTrigger>
              <AccordionContent>
                Please visit our{' '}
                <a
                  href="https://github.com/ELesch/tex-leg-ai/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  GitHub Issues page
                </a>{' '}
                to report bugs or request new features. We appreciate your feedback!
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>Can I export my data?</AccordionTrigger>
              <AccordionContent>
                Currently, you can view and manage your saved bills and team data within the app. Export functionality is planned for a future release.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            <CardTitle>External Resources</CardTitle>
          </div>
          <CardDescription>Helpful links for legislative research</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <a
              href="https://capitol.texas.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Texas Legislature Online</p>
                <p className="text-sm text-muted-foreground">Official source for bill information</p>
              </div>
            </a>

            <a
              href="https://lrl.texas.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Legislative Reference Library</p>
                <p className="text-sm text-muted-foreground">Research and historical information</p>
              </div>
            </a>

            <a
              href="https://house.texas.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Texas House of Representatives</p>
                <p className="text-sm text-muted-foreground">House member information</p>
              </div>
            </a>

            <a
              href="https://senate.texas.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Texas Senate</p>
                <p className="text-sm text-muted-foreground">Senate member information</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
