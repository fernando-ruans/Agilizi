import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { pageParams } from '../utils/pagination';
import { AppError, NotFoundError } from '../utils/errors';

export class UserController {
  // GET /api/v1/users
  async index(req: Request, res: Response) {
    const { page = '1', limit = '10', search = '', role = '' } = req.query;
    const { page: pageNum, limit: limitNum, skip } = pageParams({ page, limit });

    const where: any = { companyId: req.user!.companyId };
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }
    if (role) {
      where.role = role as string;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  // GET /api/v1/users/:id
  async show(req: Request, res: Response) {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, companyId: req.user!.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    res.json({
      status: 'success',
      data: user,
    });
  }

  // POST /api/v1/users
  async store(req: Request, res: Response) {
    const { name, email, password, role } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { email, companyId: req.user!.companyId },
    });

    if (existingUser) {
      throw new AppError('Email já cadastrado', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        companyId: req.user!.companyId,
        name,
        email,
        password: hashedPassword,
        role: role || 'operacional',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      status: 'success',
      data: user,
    });
  }

  // PUT /api/v1/users/:id
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { name, email, role, active, password } = req.body;

    const user = await prisma.user.findFirst({
      where: { id, companyId: req.user!.companyId },
    });
    if (!user) {
      throw new NotFoundError('Usuário');
    }

    // Check if email is already taken by another user in the same company
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findFirst({
        where: { email, companyId: req.user!.companyId, NOT: { id } },
      });
      if (existingUser) {
        throw new AppError('Email já cadastrado', 409);
      }
    }

    // Nobody (not even an admin) may strip their own admin access, and a
    // company must always keep at least one active admin
    const demotesSelf = id === req.user!.userId && ((role && role !== user.role) || active === false);
    if (demotesSelf) {
      throw new AppError('Você não pode remover sua própria permissão de administrador', 400);
    }
    const removesAdmin = (role && role !== 'admin' && user.role === 'admin') || active === false;
    if (removesAdmin && user.role === 'admin' && user.active) {
      const otherAdmins = await prisma.user.count({
        where: { companyId: req.user!.companyId, role: 'admin', active: true, NOT: { id } },
      });
      if (otherAdmins === 0) {
        throw new AppError('A empresa precisa de ao menos um administrador ativo', 400);
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (active !== undefined) updateData.active = active;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      status: 'success',
      data: updatedUser,
    });
  }

  // DELETE /api/v1/users/:id
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, companyId: req.user!.companyId },
    });
    if (!user) {
      throw new NotFoundError('Usuário');
    }

    if (id === req.user!.userId) {
      throw new AppError('Você não pode desativar sua própria conta', 400);
    }
    if (user.role === 'admin' && user.active) {
      const otherAdmins = await prisma.user.count({
        where: { companyId: req.user!.companyId, role: 'admin', active: true, NOT: { id } },
      });
      if (otherAdmins === 0) {
        throw new AppError('A empresa precisa de ao menos um administrador ativo', 400);
      }
    }

    // Soft delete - deactivate user
    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    res.json({
      status: 'success',
      message: 'Usuário desativado com sucesso',
    });
  }
}

export const userController = new UserController();
