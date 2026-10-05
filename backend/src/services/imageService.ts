import prisma from '../config/database';

type OwnerType = 'product' | 'client' | 'supplier' | 'company';

export type WithImages<T> = T & { images: any[] };

/**
 * Batch-loads images for a list of entities in ONE query (no N+1) and
 * attaches them as `images` on each item, preserving list order.
 */
export async function attachImages<T extends { id: string }>(
  items: T[],
  ownerType: OwnerType,
  companyId: string,
): Promise<WithImages<T>[]> {
  if (items.length === 0) return items.map((item) => ({ ...item, images: [] }));

  const images = await prisma.image.findMany({
    where: { companyId, ownerType, ownerId: { in: items.map((i) => i.id) } },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const byOwner = new Map<string, any[]>();
  images.forEach((img) => {
    const list = byOwner.get(img.ownerId) || [];
    list.push(img);
    byOwner.set(img.ownerId, list);
  });

  return items.map((item) => ({ ...item, images: byOwner.get(item.id) || [] }));
}

/** Single-entity variant (show/store/update). */
export async function attachImagesToOne<T extends { id: string }>(
  item: T,
  ownerType: OwnerType,
  companyId: string,
): Promise<WithImages<T>> {
  const [withImages] = await attachImages([item], ownerType, companyId);
  return withImages;
}
