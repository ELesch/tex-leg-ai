'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { NotificationToggle, BillNotificationToggle } from '@/components/notifications';
import { Bell, Search, Trash2, Loader2, ExternalLink, FileText } from 'lucide-react';

interface FollowedBill {
  id: string;
  notes: string | null;
  createdAt: string;
  bill: {
    id: string;
    billId: string;
    billType: string;
    billNumber: number;
    description: string;
    status: string | null;
    lastAction: string | null;
    lastActionDate: string | null;
  };
}

export default function FollowedBillsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [followedBills, setFollowedBills] = useState<FollowedBill[]>([]);
  const [filteredBills, setFilteredBills] = useState<FollowedBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/followed');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchFollowedBills() {
      try {
        const res = await fetch('/api/followed');
        if (res.ok) {
          const data = await res.json();
          setFollowedBills(data.followedBills || []);
          setFilteredBills(data.followedBills || []);
        }
      } catch (error) {
        console.error('Failed to fetch followed bills:', error);
        toast({
          title: 'Error',
          description: 'Failed to load followed bills',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchFollowedBills();
    }
  }, [status, toast]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredBills(followedBills);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = followedBills.filter((followed) => {
      const bill = followed.bill;
      return (
        bill.billId.toLowerCase().includes(query) ||
        bill.description.toLowerCase().includes(query) ||
        (followed.notes && followed.notes.toLowerCase().includes(query))
      );
    });
    setFilteredBills(filtered);
  }, [searchQuery, followedBills]);

  const handleUnfollowBill = async (billId: string) => {
    setRemovingId(billId);
    try {
      const res = await fetch('/api/followed', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId }),
      });

      if (res.ok) {
        setFollowedBills(followedBills.filter((fb) => fb.bill.billId !== billId));
        toast({
          title: 'Bill unfollowed',
          description: 'The bill has been removed from your followed list.',
        });
      } else {
        throw new Error('Failed to unfollow');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unfollow the bill',
        variant: 'destructive',
      });
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Followed Bills</h1>
            <p className="mt-1 text-muted-foreground">
              Bills you&apos;re following for updates
            </p>
          </div>
          <Link href="/bills">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Browse Bills
            </Button>
          </Link>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">

      {followedBills.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  <CardTitle>Your Followed Bills</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  {followedBills.length} bill{followedBills.length !== 1 ? 's' : ''} followed
                </CardDescription>
              </div>
              <NotificationToggle />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search within followed bills */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search your followed bills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Bills Table */}
            {filteredBills.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Bill</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="hidden md:table-cell w-[120px]">Followed</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((followed) => (
                      <TableRow key={followed.id}>
                        <TableCell>
                          <Link
                            href={`/bills/${followed.bill.billId.replace(' ', '-')}`}
                            className="flex items-center gap-2"
                          >
                            <Badge variant={followed.bill.billType === 'HB' ? 'hb' : 'sb'}>
                              {followed.bill.billType}
                            </Badge>
                            <span className="font-medium">{followed.bill.billNumber}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/bills/${followed.bill.billId.replace(' ', '-')}`}
                            className="block group"
                          >
                            <p className="line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
                              {followed.bill.description}
                            </p>
                            {followed.notes && (
                              <p className="mt-1 text-xs text-primary">
                                Note: {followed.notes}
                              </p>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {formatDate(followed.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/bills/${followed.bill.billId.replace(' ', '-')}`}>
                              <Button variant="ghost" size="icon">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                            <BillNotificationToggle
                              followedBillId={followed.id}
                              billId={followed.bill.billId}
                              compact
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  disabled={removingId === followed.bill.billId}
                                >
                                  {removingId === followed.bill.billId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Unfollow bill?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove {followed.bill.billId} from your followed bills. You can always follow it again later.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleUnfollowBill(followed.bill.billId)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Unfollow
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
                <p className="text-muted-foreground">
                  No bills match your search
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {followedBills.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">No followed bills yet</h2>
            <p className="mt-2 text-center text-muted-foreground max-w-sm">
              Start browsing bills and click the follow button to track bills you&apos;re interested in.
            </p>
            <Link href="/bills" className="mt-6">
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Browse Bills
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
