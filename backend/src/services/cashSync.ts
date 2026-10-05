import prisma from '../config/database';

/**
 * Cash-flow centralization: every financial event of the app must appear
 * in the Caixa. This module keeps those auto-generated entries in sync
 * with their source records (expenses, orders).
 *
 * Linking key: CashTransaction.reference = "<source>:<id>" — no FK, so
 * cleanup must be explicit (deleting a source record removes its entry).
 */

export const REF = {
  expense: (id: string) => `expense:${id}`,
  order: (id: string) => `order:${id}`,
};

/** Creates/updates/removes the "saida" entry of a paid expense. */
export async function syncExpenseToCash(expense: {
  id: string;
  companyId: string;
  userId?: string | null;
  description: string;
  value: number;
  category: string;
  status: string;
  date: Date;
  paidDate?: Date | null;
  paymentMethod?: string | null;
}) {
  const reference = REF.expense(expense.id);
  const existing = await prisma.cashTransaction.findFirst({
    where: { companyId: expense.companyId, reference },
  });

  const shouldBePaid = expense.status === 'pago';

  if (shouldBePaid) {
    const data = {
      companyId: expense.companyId,
      type: 'saida',
      category: 'despesa',
      description: expense.description,
      value: expense.value,
      date: expense.paidDate || expense.date,
      paymentMethod: expense.paymentMethod || null,
      userId: expense.userId || null,
    };

    if (existing) {
      // Keep value/description in sync when the expense is edited after payment
      await prisma.cashTransaction.update({ where: { id: existing.id }, data });
    } else {
      await prisma.cashTransaction.create({ data: { ...data, reference } });
    }
  } else if (existing) {
    // Unpaid (or reverted): the money never left the cash register
    await prisma.cashTransaction.delete({ where: { id: existing.id } });
  }
}

/** Removes the auto cash entry of a deleted expense. */
export async function removeExpenseFromCash(expenseId: string, companyId: string) {
  await prisma.cashTransaction.deleteMany({
    where: { companyId, reference: REF.expense(expenseId) },
  });
}

/**
 * Creates the "entrada" entry when an order (OS) is completed.
 * Order status "concluida" is terminal (no outgoing transitions).
 * The entry is created once (idempotent) and its value follows later
 * edits to the order total.
 */
export async function syncOrderToCash(order: {
  id: string;
  companyId: string;
  number: number;
  userId?: string | null;
  status: string;
  totalValue: number;
}) {
  const reference = REF.order(order.id);
  const existing = await prisma.cashTransaction.findFirst({
    where: { companyId: order.companyId, reference },
  });

  if (order.status === 'concluida') {
    if (existing) {
      // Already registered: keep the value in sync when the order total
      // is edited after completion
      if (existing.value !== order.totalValue) {
        await prisma.cashTransaction.update({
          where: { id: existing.id },
          data: { value: order.totalValue },
        });
      }
      return;
    }
    if (order.totalValue <= 0) return; // nothing to collect

    await prisma.cashTransaction.create({
      data: {
        companyId: order.companyId,
        type: 'entrada',
        category: 'servico',
        description: `OS #${String(order.number).padStart(4, '0')}`,
        value: order.totalValue,
        date: new Date(),
        userId: order.userId || null,
        reference,
      },
    });
  } else if (existing) {
    // Order reopened/cancelled before completion — undo the entry
    await prisma.cashTransaction.delete({ where: { id: existing.id } });
  }
}

/** Removes the auto cash entry of a deleted order. */
export async function removeOrderFromCash(orderId: string, companyId: string) {
  await prisma.cashTransaction.deleteMany({
    where: { companyId, reference: REF.order(orderId) },
  });
}

/**
 * One-time repair (runs on every boot, idempotent): records created BEFORE
 * the cash-centralization feature have no auto entry — without this, paid
 * old expenses would never show up in the Caixa. Also removes orphaned
 * entries whose source record was deleted while sync was offline.
 */
export async function backfillCashSync() {
  // 1) Sync every expense: paid ones get (or update) their entry, unpaid
  //    ones drop any stale entry left behind
  const allExpenses = await prisma.expense.findMany({
    select: {
      id: true, companyId: true, userId: true, description: true, value: true,
      category: true, status: true, date: true, paidDate: true, paymentMethod: true,
    },
  });

  for (const expense of allExpenses) {
    await syncExpenseToCash(expense);
  }
  const paidExpenses = allExpenses.filter((e) => e.status === 'pago');

  // 2) Completed orders missing their cash entry
  const completedOrders = await prisma.order.findMany({
    where: { status: 'concluida' },
    select: { id: true, companyId: true, number: true, userId: true, status: true, totalValue: true },
  });
  for (const order of completedOrders) {
    await syncOrderToCash(order);
  }

  // 3) Orphaned auto entries (source deleted while sync was not running)
  // 3) Orphaned auto entries (source deleted while sync was not running).
  // Covers expenses AND orders (sales can only be cancelled, which already
  // removes the entry, so sale:* needs no cleanup).
  let orphansRemoved = 0;
  const autoEntries = await prisma.cashTransaction.findMany({
    where: { OR: [{ reference: { startsWith: 'expense:' } }, { reference: { startsWith: 'order:' } }] },
    select: { id: true, companyId: true, reference: true },
  });
  const expenseIds = new Set(paidExpenses.map((e) => `expense:${e.id}`));
  const completedOrderIds = new Set(completedOrders.map((o) => `order:${o.id}`));
  for (const entry of autoEntries) {
    const reference = entry.reference;
    if (!reference) continue;
    if (reference.startsWith('expense:') && expenseIds.has(reference)) continue;
    if (reference.startsWith('order:') && completedOrderIds.has(reference)) continue;
    // Only delete if the source record no longer exists at all (an unpaid
    // expense or a non-concluded order keeps no entry by design — but a
    // concluded order / paid expense must have one)
    const [prefix, ...rest] = reference.split(':');
    const sourceId = rest.join(':');
    if (!sourceId) continue;
    const stillExists =
      prefix === 'expense'
        ? await prisma.expense.findUnique({ where: { id: sourceId }, select: { id: true } })
        : await prisma.order.findUnique({ where: { id: sourceId }, select: { id: true, status: true } });
    if (!stillExists || (prefix === 'order' && (stillExists as any).status !== 'concluida')) {
      await prisma.cashTransaction.delete({ where: { id: entry.id } });
      orphansRemoved += 1;
    }
  }

  return {
    expenses: paidExpenses.length,
    orders: completedOrders.length,
    orphansRemoved,
  };
}
