const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const templates = await p.checklistTemplate.findMany({
    select: { id: true, name: true, isActive: true, userId: true }
  });
  console.log('Templates found:', templates.length);
  console.log(JSON.stringify(templates, null, 2));
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
