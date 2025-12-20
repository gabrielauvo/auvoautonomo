import { PrismaClient, PlanType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Criar planos com limites de uso
  const plans = [
    {
      type: PlanType.FREE,
      name: 'Plano Gratuito',
      description: 'Ideal para começar. Recursos essenciais com limites básicos.',
      price: 0,
      yearlyPrice: null,
      maxClients: 10,
      maxQuotes: 10,
      maxWorkOrders: 10,
      maxInvoices: 5,
      features: [
        'Até 10 clientes',
        'Até 10 orçamentos',
        'Até 10 ordens de serviço',
        'Até 5 cobranças',
      ],
      isActive: true,
      usageLimits: {
        maxClients: 10,
        maxQuotes: 10,
        maxWorkOrders: 10,
        maxPayments: 5,
        maxNotificationsPerMonth: 50,
        enableAdvancedAutomations: false,
        enableAdvancedAnalytics: false,
        enableClientPortal: false,
        enablePdfExport: true,
        enableDigitalSignature: false,
        enableWhatsApp: false,
      },
    },
    {
      type: PlanType.PRO,
      name: 'Plano Profissional',
      description: 'Para profissionais que precisam de mais. Recursos avançados e limites expandidos.',
      price: 39.90,
      yearlyPrice: 399.00, // 10 meses (2 grátis)
      maxClients: -1, // ilimitado
      maxQuotes: -1,
      maxWorkOrders: -1,
      maxInvoices: -1,
      features: [
        'Clientes ilimitados',
        'Orçamentos ilimitados',
        'Ordens de serviço ilimitadas',
        'Cobranças ilimitadas',
        'Templates personalizados',
        'Relatórios avançados',
        'Suporte prioritário',
      ],
      isActive: true,
      usageLimits: {
        maxClients: -1,
        maxQuotes: -1,
        maxWorkOrders: -1,
        maxPayments: -1,
        maxNotificationsPerMonth: -1,
        enableAdvancedAutomations: true,
        enableAdvancedAnalytics: true,
        enableClientPortal: true,
        enablePdfExport: true,
        enableDigitalSignature: true,
        enableWhatsApp: true,
      },
    },
    {
      type: PlanType.TEAM,
      name: 'Plano Team',
      description: 'Para equipes. Tudo do PRO + múltiplos usuários e recursos colaborativos.',
      price: 99.90,
      yearlyPrice: 999.00, // 10 meses (2 grátis)
      maxClients: -1,
      maxQuotes: -1,
      maxWorkOrders: -1,
      maxInvoices: -1,
      features: [
        'Tudo do Plano PRO',
        'Múltiplos usuários',
        'Gestão de equipe',
        'API access',
        'Relatórios personalizados',
        'Suporte dedicado',
      ],
      isActive: false, // Desativado - apenas FREE e PRO disponíveis
      usageLimits: {
        maxClients: -1,
        maxQuotes: -1,
        maxWorkOrders: -1,
        maxPayments: -1,
        maxNotificationsPerMonth: -1,
        enableAdvancedAutomations: true,
        enableAdvancedAnalytics: true,
        enableClientPortal: true,
        enablePdfExport: true,
        enableDigitalSignature: true,
        enableWhatsApp: true,
      },
    },
  ];

  for (const planData of plans) {
    const { usageLimits, ...plan } = planData;

    // Upsert plan
    const createdPlan = await prisma.plan.upsert({
      where: { type: plan.type },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        yearlyPrice: plan.yearlyPrice,
        maxClients: plan.maxClients,
        maxQuotes: plan.maxQuotes,
        maxWorkOrders: plan.maxWorkOrders,
        maxInvoices: plan.maxInvoices,
        features: plan.features,
        isActive: plan.isActive,
      },
      create: plan,
    });

    console.log(`✅ Plan ${plan.name} created/updated`);

    // Upsert usage limits
    await prisma.usageLimitsConfig.upsert({
      where: { planId: createdPlan.id },
      update: usageLimits,
      create: {
        planId: createdPlan.id,
        ...usageLimits,
      },
    });

    console.log(`✅ Usage limits for ${plan.name} created/updated`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
