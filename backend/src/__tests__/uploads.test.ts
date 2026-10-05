import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import app from '../app';
import { config } from '../config';
import prisma from '../config/database';
import { registerCompany, auth, createClient, createProduct, TestCompany } from './helpers';

/** Generates a real 40×40 PNG so sharp can process it. */
async function pngFixture(): Promise<Buffer> {
  return sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 30, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

function diskPathFromUrl(url: string): string {
  // url: /uploads/<companyId>/<fileName>
  return path.join(config.uploadsDir, ...url.replace(/^\/uploads\//, '').split('/'));
}

describe('Uploads API', () => {
  let tenant: TestCompany;
  let other: TestCompany;
  let productId: string;
  let clientId: string;
  let otherClientId: string;

  beforeAll(async () => {
    tenant = await registerCompany({ prefix: 'upl' });
    other = await registerCompany({ prefix: 'oth' });
    productId = (await createProduct(tenant.token, { name: 'Produto com foto' })).id;
    clientId = await createClient(tenant.token, 'Cliente com foto');
    otherClientId = await createClient(other.token, 'Cliente do outro');
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  });

  afterAll(async () => {
    // Remove images created by this suite
    const images = await prisma.image.findMany({
      where: { companyId: { in: [tenant.companyId, other.companyId] } },
    });
    for (const img of images) {
      const p = diskPathFromUrl(img.url);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      await prisma.image.delete({ where: { id: img.id } }).catch(() => {});
    }
  });

  describe('POST /api/v1/uploads', () => {
    it('rejects unauthenticated uploads (401)', async () => {
      const res = await request(app)
        .post('/api/v1/uploads')
        .attach('file', await pngFixture(), { filename: 'a.png', contentType: 'image/png' })
        .field('entityType', 'product')
        .field('entityId', productId);
      expect(res.status).toBe(401);
    });

    it('rejects invalid MIME types (400)', async () => {
      const res = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', Buffer.from('not an image'), {
          filename: 'evil.txt',
          contentType: 'text/plain',
        })
        .field('entityType', 'product')
        .field('entityId', productId);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/formato de imagem/i);
    });

    it('rejects files bigger than 5MB (400)', async () => {
      const big = Buffer.alloc(6 * 1024 * 1024, 1);
      const res = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
        .field('entityType', 'product')
        .field('entityId', productId);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/5MB/i);
    });

    it('rejects an unknown entityType (400)', async () => {
      const res = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', await pngFixture(), { filename: 'a.png', contentType: 'image/png' })
        .field('entityType', 'banana')
        .field('entityId', productId);
      expect(res.status).toBe(400);
    });

    it('attaches an image to a product and writes it to disk', async () => {
      const res = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', await pngFixture(), { filename: 'foto.png', contentType: 'image/png' })
        .field('entityType', 'product')
        .field('entityId', productId);

      expect(res.status).toBe(201);
      expect(res.body.data.url).toMatch(/^\/uploads\//);
      expect(res.body.data.mimeType).toBe('image/webp');
      expect(fs.existsSync(diskPathFromUrl(res.body.data.url))).toBe(true);
    });

    it('multi-tenancy: cannot attach to another company entity (404)', async () => {
      const res = await request(app)
        .post('/api/v1/uploads')
        .set(auth(other.token))
        .attach('file', await pngFixture(), { filename: 'a.png', contentType: 'image/png' })
        .field('entityType', 'client')
        .field('entityId', clientId); // belongs to tenant
      expect(res.status).toBe(404);
    });

    it('rejects attaching to a nonexistent entity (404)', async () => {
      const res = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', await pngFixture(), { filename: 'a.png', contentType: 'image/png' })
        .field('entityType', 'product')
        .field('entityId', 'does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/uploads', () => {
    it('lists images for an entity, scoped by company', async () => {
      const res = await request(app)
        .get('/api/v1/uploads')
        .query({ entityType: 'product', entityId: productId })
        .set(auth(tenant.token));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((i: any) => i.ownerId === productId)).toBe(true);
    });

    it('404 when listing images of another company entity', async () => {
      const res = await request(app)
        .get('/api/v1/uploads')
        .query({ entityType: 'client', entityId: clientId })
        .set(auth(other.token));
      expect(res.status).toBe(404);
    });

    it('400 when entityType/entityId missing', async () => {
      const res = await request(app).get('/api/v1/uploads').set(auth(tenant.token));
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/uploads/:id', () => {
    it('removes the file from disk and the record', async () => {
      const upload = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', await pngFixture(), { filename: 'gone.png', contentType: 'image/png' })
        .field('entityType', 'product')
        .field('entityId', productId);
      const image = upload.body.data;
      const filePath = diskPathFromUrl(image.url);
      expect(fs.existsSync(filePath)).toBe(true);

      await request(app)
        .delete(`/api/v1/uploads/${image.id}`)
        .set(auth(tenant.token))
        .expect(200);

      expect(fs.existsSync(filePath)).toBe(false);
      const stillThere = await prisma.image.findUnique({ where: { id: image.id } });
      expect(stillThere).toBeNull();
    });

    it('404 when deleting another company image', async () => {
      const upload = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', await pngFixture(), { filename: 'mine.png', contentType: 'image/png' })
        .field('entityType', 'client')
        .field('entityId', clientId);

      await request(app)
        .delete(`/api/v1/uploads/${upload.body.data.id}`)
        .set(auth(other.token))
        .expect(404);
    });
  });

  describe('static serving + entity payloads', () => {
    it('GET /uploads/<file> serves the file', async () => {
      const upload = await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', await pngFixture(), { filename: 'static.png', contentType: 'image/png' })
        .field('entityType', 'product')
        .field('entityId', productId);

      const res = await request(app).get(upload.body.data.url);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image/);
    });

    it('product payload includes images (batch attach)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${productId}`)
        .set(auth(tenant.token))
        .expect(200);
      expect(Array.isArray(res.body.data.images)).toBe(true);
      expect(res.body.data.images.length).toBeGreaterThan(0);
    });

    it('client payload includes images', async () => {
      await request(app)
        .post('/api/v1/uploads')
        .set(auth(tenant.token))
        .attach('file', await pngFixture(), { filename: 'c.png', contentType: 'image/png' })
        .field('entityType', 'client')
        .field('entityId', clientId)
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/clients/${clientId}`)
        .set(auth(tenant.token))
        .expect(200);
      expect(res.body.data.images.length).toBeGreaterThan(0);
    });

    it('other company client payload has no leaked images', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${otherClientId}`)
        .set(auth(other.token))
        .expect(200);
      expect(res.body.data.images).toEqual([]);
    });
  });
});
