import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create demo company
  const company = await prisma.company.create({
    data: {
      name: 'Agilzi Demo',
      tradeName: 'Minha Empresa',
      type: 'ambos',
      document: '12.345.678/0001-90',
      phone: '(11) 99999-0000',
      email: 'contato@demo.com',
      city: 'São Paulo',
      state: 'SP',
    },
  });

  // Create admin user
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Administrador',
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log(`✅ Company: ${company.name}`);
  console.log(`✅ Admin: admin@demo.com / admin123`);

  // Create services
  const services = [
    { name: 'Consultoria', description: 'Serviço de consultoria geral', value: 150, category: 'Consultoria' },
    { name: 'Manutenção Preventiva', description: 'Manutenção preventiva de equipamentos', value: 200, category: 'Manutenção' },
    { name: 'Instalação', description: 'Instalação de equipamentos', value: 300, category: 'Instalação' },
    { name: 'Reparo', description: 'Reparo de equipamentos', value: 250, category: 'Manutenção' },
    { name: 'Suporte Técnico', description: 'Suporte técnico remoto ou presencial', value: 100, category: 'Suporte' },
  ];

  for (const service of services) {
    await prisma.service.create({ data: { ...service, companyId: company.id } });
  }
  console.log(`✅ ${services.length} services created`);

  // Create products
  const products = [
    { name: 'Notebook Dell', price: 4500, costPrice: 3200, stock: 10, category: 'Informática', barcode: '7891234567890' },
    { name: 'Mouse Logitech', price: 89, costPrice: 45, stock: 50, category: 'Acessórios', barcode: '7891234567891' },
    { name: 'Teclado Mecânico', price: 250, costPrice: 140, stock: 25, category: 'Acessórios', barcode: '7891234567892' },
    { name: 'Monitor 24"', price: 1200, costPrice: 800, stock: 15, category: 'Informática', barcode: '7891234567893' },
    { name: 'Cabo HDMI 2m', price: 35, costPrice: 12, stock: 100, category: 'Acessórios', barcode: '7891234567894' },
  ];

  for (const product of products) {
    await prisma.product.create({ data: { ...product, companyId: company.id } });
  }
  console.log(`✅ ${products.length} products created`);

  // Create clients
  const clients = [
    { name: 'João Silva', email: 'joao@email.com', phone: '(11) 99999-1234', document: '123.456.789-00', documentType: 'cpf', city: 'São Paulo', state: 'SP' },
    { name: 'Empresa ABC Ltda', email: 'contato@abc.com', phone: '(11) 3333-4567', document: '12.345.678/0001-90', documentType: 'cnpj', city: 'São Paulo', state: 'SP' },
  ];

  for (const client of clients) {
    await prisma.client.create({ data: { ...client, companyId: company.id } });
  }
  console.log(`✅ ${clients.length} clients created`);

  // Create suppliers
  await prisma.supplier.create({
    data: { name: 'Fornecedor XYZ', companyName: 'XYZ Materiais Ltda', document: '98.765.432/0001-10', email: 'vendas@xyz.com', city: 'São Paulo', state: 'SP', companyId: company.id },
  });
  console.log('✅ 1 supplier created');

  // Create company settings
  await prisma.companySetting.createMany({
    data: [
      { companyId: company.id, key: 'next_budget_number', value: '1' },
      { companyId: company.id, key: 'next_order_number', value: '1' },
      { companyId: company.id, key: 'next_sale_number', value: '1' },
    ],
  });

  console.log('🎉 Seeding completed!');
  console.log(`\n📌 Login: admin@demo.com / admin123`);
  console.log(`📌 Empresa: ${company.name} (${company.type})`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
