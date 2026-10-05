import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AppError, UnauthorizedError } from '../utils/errors';
import { generateToken, generateRefreshToken } from '../middlewares/auth';
import { logger } from '../utils/logger';

export class AuthController {
  // POST /api/v1/auth/login
  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    if (!user.active) {
      throw new UnauthorizedError('Conta desativada. Contate o administrador.');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    const tokenPayload = {
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    logger.info(`User logged in: ${user.email}`);

    // Find user with company
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { company: true },
    });

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
        company: fullUser?.company ? {
          id: fullUser.company.id,
          name: fullUser.company.name,
          tradeName: fullUser.company.tradeName,
          type: fullUser.company.type,
          logo: fullUser.company.logo,
        } : null,
        token,
        refreshToken,
      },
    });
  }

  // POST /api/v1/auth/register
  async register(req: Request, res: Response) {
    const { name, email, password, companyName, companyTradeName, companyDocument, companyType } = req.body;

    // Check if user email already exists across all companies
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('Email já cadastrado', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create company + user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: companyName,
          tradeName: companyTradeName || null,
          // Frontend sends masked document — persist digits only,
          // same as the company update path
          document: companyDocument ? companyDocument.replace(/\D/g, '') || null : null,
          type: companyType || 'ambos',
        },
      });

      // Create admin user for the company
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name,
          email,
          password: hashedPassword,
          role: 'admin',
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          companyId: true,
        },
      });

      // Create default sequential counters
      await tx.companySetting.createMany({
        data: [
          { companyId: company.id, key: 'next_budget_number', value: '1' },
          { companyId: company.id, key: 'next_order_number', value: '1' },
          { companyId: company.id, key: 'next_sale_number', value: '1' },
        ],
      });

      return { company, user };
    });

    const tokenPayload = {
      userId: result.user.id,
      companyId: result.company.id,
      email: result.user.email,
      role: result.user.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    logger.info(`New company registered: ${result.company.name} by ${result.user.email}`);

    res.status(201).json({
      status: 'success',
      data: {
        user: result.user,
        company: {
          id: result.company.id,
          name: result.company.name,
          tradeName: result.company.tradeName,
          type: result.company.type,
        },
        token,
        refreshToken,
      },
    });
  }

  // GET /api/v1/auth/me
  async me(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    res.json({
      status: 'success',
      data: user,
    });
  }

  // POST /api/v1/auth/change-password
  async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      throw new AppError('Senha atual incorreta', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed for user: ${user.email}`);

    res.json({
      status: 'success',
      message: 'Senha alterada com sucesso',
    });
  }

  // PUT /api/v1/auth/me — update own profile (name, email)
  async updateProfile(req: Request, res: Response) {
    const { name, email } = req.body;
    const userId = req.user!.userId;

    // If email is changing, ensure it's not used by another user
    // Login looks users up by email GLOBALLY (across companies), so the
    // check must be global too — otherwise two companies end up sharing
    // an email and one of them can no longer log in
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (existing) {
        throw new AppError('Email já em uso por outra conta', 409);
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: { id: true, name: true, email: true, role: true, companyId: true, active: true },
    });

    logger.info(`Profile updated for user: ${user.email}`);
    res.json({ status: 'success', data: user });
  }
}

export const authController = new AuthController();
