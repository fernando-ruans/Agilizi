import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Image } from '../types';

interface ImageGalleryProps {
  images: Image[];
}

/** Simple lightbox gallery for viewing an entity's images. */
export function ImageGallery({ images }: ImageGalleryProps) {
  const [index, setIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const prev = () => setIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  const next = () => setIndex((i) => (i === null ? null : (i + 1) % images.length));

  return (
    <>
      <ul className="grid grid-cols-4 gap-2" role="list">
        {images.map((image, i) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="w-full aspect-square rounded-md overflow-hidden border border-gray-200 bg-gray-50 hover:border-gray-300 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
              aria-label={`Ver imagem ${i + 1} de ${images.length}`}
            >
              <img src={image.url} alt={image.fileName || `Imagem ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>

      {index !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de imagens"
          onClick={() => setIndex(null)}
        >
          <button
            type="button"
            onClick={() => setIndex(null)}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              aria-label="Imagem anterior"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          <img
            src={images[index].url}
            alt={images[index].fileName || `Imagem ${index + 1}`}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              aria-label="Próxima imagem"
            >
              <ChevronRight size={24} />
            </button>
          )}

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">
            {index + 1} / {images.length}
          </span>
        </div>
      )}
    </>
  );
}
