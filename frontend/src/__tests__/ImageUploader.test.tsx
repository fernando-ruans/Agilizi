import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUploader } from '../components/ImageUploader';
import type { Image } from '../types';

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import api from '../services/api';
import toast from 'react-hot-toast';

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
const mockedToast = toast as unknown as { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

// Deterministic factory: same id ⇒ same object, so assertions can compare deeply
const imageCache = new Map<string, Image>();
const image = (id: string): Image => {
  const cached = imageCache.get(id);
  if (cached) return cached;
  const created: Image = {
    id,
    companyId: 'c1',
    ownerType: 'product',
    ownerId: 'p1',
    url: `/uploads/c1/${id}.webp`,
    isPrimary: id === 'img1',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  imageCache.set(id, created);
  return created;
};

function makeFile(name = 'foto.png', type = 'image/png', size = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('ImageUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropzone and existing thumbnails', () => {
    render(
      <ImageUploader entityType="product" entityId="p1" images={[image('img1')]} multiple onChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: /adicionar imagem/i })).toBeInTheDocument();
    expect(screen.getByAltText('Imagem anexada')).toBeInTheDocument();
  });

  it('uploads a valid file and reports it to the parent', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockedApi.post.mockResolvedValue({ data: { data: image('img2') } });

    render(
      <ImageUploader entityType="product" entityId="p1" images={[image('img1')]} multiple onChange={onChange} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile());

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [url, body] = mockedApi.post.mock.calls[0];
    expect(url).toBe('/uploads');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('entityType')).toBe('product');
    expect((body as FormData).get('entityId')).toBe('p1');
    expect(onChange).toHaveBeenCalledWith([image('img1'), image('img2')]);
    expect(mockedToast.success).toHaveBeenCalled();
  });

  it('rejects invalid file types client-side (no request made)', () => {
    // fireEvent (not userEvent.upload): jsdom's upload helper filters files
    // against the input's accept attribute before dispatching
    render(
      <ImageUploader entityType="product" entityId="p1" images={[]} multiple onChange={vi.fn()} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('doc.pdf', 'application/pdf')] } });

    expect(mockedApi.post).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledWith(expect.stringMatching(/formato inválido/i));
  });

  it('rejects files over 5MB client-side', () => {
    render(
      <ImageUploader entityType="product" entityId="p1" images={[]} multiple onChange={vi.fn()} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('gigante.png', 'image/png', 6 * 1024 * 1024)] },
    });

    expect(mockedApi.post).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledWith(expect.stringMatching(/muito grande/i));
  });

  it('blocks upload when the entity is not saved yet', () => {
    render(
      <ImageUploader entityType="product" entityId={undefined} images={[]} multiple onChange={vi.fn()} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    expect(mockedApi.post).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledWith(expect.stringMatching(/salve o registro/i));
  });

  it('deletes an image through the API', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockedApi.delete.mockResolvedValue({ data: {} });

    render(
      <ImageUploader entityType="product" entityId="p1" images={[image('img1')]} multiple onChange={onChange} />
    );

    await user.click(screen.getByRole('button', { name: /excluir imagem/i }));

    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/uploads/img1'));
    expect(onChange).toHaveBeenCalledWith([]);
    expect(mockedToast.success).toHaveBeenCalled();
  });

  it('shows a server error toast when upload fails', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockRejectedValue({ response: { data: { message: 'Erro no servidor' } } });

    render(
      <ImageUploader entityType="product" entityId="p1" images={[]} multiple onChange={vi.fn()} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile());

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith('Erro no servidor'));
  });
});
