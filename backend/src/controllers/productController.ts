import { Request, Response } from 'express';
import prisma from '../config/database';
import { pageParams } from '../utils/pagination';
import { NotFoundError } from '../utils/errors';
import { attachImages, attachImagesToOne } from '../services/imageService';

export class ProductController {
  // GET /api/v1/products
  async index(req: Request, res: Response) {
    const { page = '1', limit = '10', search = '', category = '', lowStock = '' } = req.query;
    const { page: pageNum, limit: limitNum, skip } = pageParams({ page, limit });

    const where: any = { companyId: req.user!.companyId };
    if (category) where.category = category as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { barcode: { contains: search as string } },
        { category: { contains: search as string } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.product.count({ where }),
    ]);

    // Low stock: filter in-memory (Prisma cannot compare two columns directly)
    const filtered = lowStock === 'true'
      ? products.filter((p) => p.stock <= p.minStock)
      : products;
    const result = await attachImages(filtered, 'product', req.user!.companyId);

    res.json({
      status: 'success',
      data: result,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  }

  // GET /api/v1/products/:id
  async show(req: Request, res: Response) {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!product) throw new NotFoundError('Produto');
    const data = await attachImagesToOne(product, 'product', req.user!.companyId);
    res.json({ status: 'success', data });
  }

  // POST /api/v1/products
  async store(req: Request, res: Response) {
    const { name, description, price, costPrice, stock, minStock, barcode, category, unit } = req.body;
    const product = await prisma.product.create({
      data: {
        companyId: req.user!.companyId,
        name,
        description: description || null,
        price,
        costPrice: costPrice ?? null,
        stock: stock ?? 0,
        minStock: minStock ?? 0,
        barcode: barcode || null,
        category: category || null,
        unit: unit || 'un',
      },
    });
    const data = await attachImagesToOne(product, 'product', req.user!.companyId);
    res.status(201).json({ status: 'success', data });
  }

  // PUT /api/v1/products/:id
  async update(req: Request, res: Response) {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!existing) throw new NotFoundError('Produto');

    const { name, description, price, costPrice, stock, minStock, barcode, category, unit, active } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(costPrice !== undefined && { costPrice }),
        ...(stock !== undefined && { stock }),
        ...(minStock !== undefined && { minStock }),
        ...(barcode !== undefined && { barcode }),
        ...(category !== undefined && { category }),
        ...(unit && { unit }),
        ...(active !== undefined && { active }),
      },
    });
    const data = await attachImagesToOne(product, 'product', req.user!.companyId);
    res.json({ status: 'success', data });
  }

  // DELETE /api/v1/products/:id (soft delete)
  async delete(req: Request, res: Response) {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!existing) throw new NotFoundError('Produto');
    await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ status: 'success', message: 'Produto desativado' });
  }

  // GET /api/v1/products/summary
  async summary(req: Request, res: Response) {
    const where = { companyId: req.user!.companyId, active: true };
    const [count, totalStock, allProducts] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.aggregate({ where, _sum: { stock: true } }),
      prisma.product.findMany({ where, select: { stock: true, minStock: true } }),
    ]);
    const lowStock = allProducts.filter((p) => p.stock <= p.minStock).length;
    res.json({
      status: 'success',
      data: { count, totalStock: totalStock._sum.stock || 0, lowStock },
    });
  }
}

export const productController = new ProductController();
