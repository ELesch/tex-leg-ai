import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/admin/require-admin';
import { UserTable } from '@/components/admin/user-table';

async function getUsers() {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.user.count(),
  ]);

  return {
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    })),
    pagination: {
      page: 1,
      limit: 20,
      total,
      totalPages: Math.ceil(total / 20),
    },
  };
}

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const { users, pagination } = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">
          View and manage user accounts and roles
        </p>
      </div>

      <UserTable
        initialUsers={users}
        initialPagination={pagination}
        currentUserId={session.user.id}
      />
    </div>
  );
}
