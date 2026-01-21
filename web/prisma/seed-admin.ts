import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@txlegai.com';
  const password = 'pcl-is-awesome!';
  const name = 'Admin';

  // Hash password with cost factor 12 (matching auth.ts)
  const passwordHash = await bcrypt.hash(password, 12);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Update existing user to admin
    const user = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        passwordHash,
      },
    });
    console.log(`Updated existing user to admin: ${user.email}`);
  } else {
    // Create new admin user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log(`Created admin user: ${user.email}`);
  }

  console.log('Admin account ready!');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
