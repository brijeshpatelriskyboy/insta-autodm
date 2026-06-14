import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@instaautodm.com" },
    update: {
      name: "Demo Creator",
      passwordHash,
    },
    create: {
      email: "demo@instaautodm.com",
      name: "Demo Creator",
      passwordHash,
    },
  });

  const rules = [
    {
      keyword: "GUIDE",
      dmMessage:
        "Hey! Thanks for commenting GUIDE. Here is your free guide: https://example.com/guide",
      isActive: true,
    },
    {
      keyword: "START",
      dmMessage:
        "Welcome! Commented START — here is how to get going: https://example.com/start",
      isActive: true,
    },
    {
      keyword: "PDF",
      dmMessage:
        "Here is your PDF download link: https://example.com/pdf — enjoy!",
      isActive: false,
    },
  ];

  for (const rule of rules) {
    await prisma.keywordRule.upsert({
      where: {
        userId_keyword: { userId: user.id, keyword: rule.keyword },
      },
      update: {
        dmMessage: rule.dmMessage,
        isActive: rule.isActive,
      },
      create: {
        userId: user.id,
        ...rule,
      },
    });
  }

  console.log(`Seeded demo user: ${user.email}`);
  console.log(`Seeded ${rules.length} keyword rules: ${rules.map((r) => r.keyword).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
