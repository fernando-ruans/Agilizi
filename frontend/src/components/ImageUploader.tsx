import { useRef, useState, useCallback } from 'react';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Image } from '../types';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

interface ImageUploaderProps {
  entityType: 'product' | 'client' | 'supplier' | 'company' | 'user';
  entityId?: string;
  images?: Image[];
  multiple?: boolean;
  onChange: (images: Image[]) => void;
  /** Shown when the entity does not exist yet (upload starts after save) */
  disabled?: boolean;
}

export function ImageUploader({
  entityType,
  entityId,
  images = [],
  multiple = false,
  onChange,
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      if (!entityId) {
        toast.error('Salve o registro antes de adicionar imagens');
        return;
      }

      const list = Array.from(files);
      const valid = list.filter((f) => {
        if (!ACCEPTED.includes(f.type)) {
          toast.error(`${f.name}: formato inválido. Use JPG, PNG, WebP ou GIF.`);
          return false;
        }
        if (f.size > MAX_SIZE) {
          toast.error(`${f.name}: imagem muito grande (máx. 5MB).`);
          return false;
        }
        return true;
      });
      if (valid.length === 0) return;
      if (!multiple && valid.length > 1) {
        toast.error('Envie apenas uma imagem');
        return;
      }

      setUploading(true);
      try {
        const uploaded: Image[] = [];
        for (const file of valid) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('entityType', entityType);
          formData.append('entityId', entityId);
          const { data } = await api.post('/uploads', formData);
          uploaded.push(data.data);
        }

        if (!multiple && images.length > 0) {
          // Single mode (logo): the new image replaces the previous ones
          await Promise.all(images.map((image) => api.delete(`/uploads/${image.id}`)));
          onChange(uploaded);
        } else {
          onChange([...images, ...uploaded]);
        }
        toast.success(uploaded.length > 1 ? 'Imagens adicionadas' : 'Imagem adicionada');
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Erro ao enviar imagem');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [entityId, entityType, images, multiple, onChange]
  );

  const remove = useCallback(
    async (image: Image) => {
      try {
        await api.delete(`/uploads/${image.id}`);
        onChange(images.filter((i) => i.id !== image.id));
        toast.success('Imagem removida');
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Erro ao remover imagem');
      }
    },
    [images, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || uploading) return;
      if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
    },
    [disabled, uploading, upload]
  );

  return (
    <div>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-5 text-center transition-colors
          ${dragging ? 'border-brand-400 bg-brand-50/50 dark:border-brand-500 dark:bg-brand-900/20' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'}
          disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Adicionar imagem"
      >
        {uploading ? (
          <Loader2 size={20} className="text-gray-400 animate-spin dark:text-slate-500" />
        ) : (
          <ImagePlus size={20} className="text-gray-400 dark:text-slate-500" />
        )}
        <span className="text-[13px] text-gray-500 dark:text-slate-400">
          {uploading ? 'Enviando…' : 'Clique ou arraste uma imagem'}
        </span>
        <span className="text-xs text-gray-400 dark:text-slate-500">JPG, PNG, WebP ou GIF · máx. 5MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => e.target.files && upload(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />

      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2" role="list">
          {images.map((image) => (
            <li key={image.id} className="relative group aspect-square rounded-md overflow-hidden border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
              <img
                src={image.url}
                alt={image.fileName || 'Imagem anexada'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => remove(image)}
                disabled={uploading}
                className="absolute top-1 right-1 p-1 rounded bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity dark:bg-slate-900/90 dark:text-red-400 dark:hover:bg-red-950"
                aria-label={`Excluir imagem ${image.fileName || ''}`.trim()}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
