import { useState, useEffect } from 'react';
import { Pencil, Trash2, Package, AlertTriangle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Product } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { Field, FieldGrid, DetailSection } from '../components/DetailFields';
import { ImageUploader } from '../components/ImageUploader';
import { ImageGallery } from '../components/ImageGallery';
import { formatCurrency } from '../utils/formatters';
import { Spinner } from '../components/Loading';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: 0, costPrice: 0,
    stock: 0, minStock: 0, barcode: '', category: '', unit: 'un',
  });

  useEffect(() => { load(); }, [page, search, lowStockOnly]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/products', {
        params: { page, limit: 10, search, ...(lowStockOnly && { lowStock: 'true' }) },
      });
      setProducts(r.data.data);
      setPagination(r.data.pagination);
    } catch { toast.error('Erro ao carregar produtos'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (selected) {
        await api.put(`/products/${selected.id}`, form);
        toast.success('Produto atualizado');
      } else {
        await api.post('/products', form);
        toast.success('Produto criado');
      }
      setModalOpen(false); reset(); load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      toast.success('Produto desativado');
      setDeleteTarget(null); load();
    } catch { toast.error('Erro ao desativar'); }
  };

  const openEdit = (p: Product) => {
    setSelected(p);
    setForm({
      name: p.name, description: p.description || '', price: p.price,
      costPrice: p.costPrice || 0, stock: p.stock, minStock: p.minStock,
      barcode: p.barcode || '', category: p.category || '', unit: p.unit,
    });
    setModalOpen(true);
  };

  const reset = () => {
    setSelected(null);
    setForm({ name: '', description: '', price: 0, costPrice: 0, stock: 0, minStock: 0, barcode: '', category: '', unit: 'un' });
  };

  const isLowStock = (p: Product) => p.stock <= p.minStock;

  const columns = [
    {
      key: 'name', label: 'Produto',
      render: (i: Product) => (
        <span className="flex items-center gap-2.5">
          {i.images && i.images.length > 0 ? (
            <img src={i.images[0].url} alt="" className="w-9 h-9 rounded-md object-cover border border-gray-200 bg-gray-50 flex-shrink-0 dark:border-slate-700 dark:bg-slate-800" loading="lazy" />
          ) : (
            <span className="w-9 h-9 rounded-md border border-dashed border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-center dark:border-slate-700 dark:bg-slate-800">
              <Package size={14} className="text-gray-300 dark:text-slate-600" />
            </span>
          )}
          <span className="font-medium text-gray-800 dark:text-slate-100">{i.name}</span>
        </span>
      ),
    },
    { key: 'barcode', label: 'Código', render: (i: Product) => <span className="font-mono text-[12px] text-gray-500 dark:text-slate-400">{i.barcode || '—'}</span> },
    { key: 'category', label: 'Categoria', render: (i: Product) => <span className="text-gray-500 dark:text-slate-400">{i.category || '—'}</span> },
    { key: 'price', label: 'Preço', render: (i: Product) => <span className="tabular-nums font-medium">{formatCurrency(i.price)}</span> },
    {
      key: 'margin', label: 'Margem',
      render: (i: Product) => {
        if (i.costPrice == null || i.costPrice <= 0) {
          return <span className="text-[12px] text-gray-400 dark:text-slate-600" title="Cadastre o preço de custo para ver a margem">—</span>;
        }
        const profit = i.price - i.costPrice;
        const pct = (profit / i.price) * 100;
        const positive = profit >= 0;
        return (
          <span
            className={`badge ${positive ? 'badge-success' : 'badge-danger'}`}
            title={`Lucro unitário: ${formatCurrency(profit)} · Custo: ${formatCurrency(i.costPrice)}`}
          >
            {pct.toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: 'stock', label: 'Estoque',
      render: (i: Product) => (
        <span className={`badge ${isLowStock(i) ? 'badge-danger' : 'badge-success'}`}>
          {i.stock} {i.unit}
        </span>
      ),
    },
    {
      key: 'actions', label: '', className: 'w-24',
      render: (i: Product) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setSelected(i); setViewOpen(true); }} className="btn-ghost btn-sm p-1.5 rounded" title="Ver detalhes">
            <Eye size={14} className="text-gray-400 dark:text-slate-500" />
          </button>
          <button onClick={() => openEdit(i)} className="btn-ghost btn-sm p-1.5 rounded" title="Editar">
            <Pencil size={14} className="text-gray-400 dark:text-slate-500" />
          </button>
          <button onClick={() => setDeleteTarget(i)} className="btn-ghost btn-sm p-1.5 rounded" title="Desativar">
            <Trash2 size={14} className="text-gray-400 hover:text-red-500 dark:text-slate-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Produtos" subtitle="Controle de produtos e estoque" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Novo Produto" />

      <div className="flex gap-3 mb-4 max-w-xl">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Buscar produto, código..." /></div>
        <button
          onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1); }}
          className={`btn btn-sm ${lowStockOnly ? 'btn-danger-solid' : 'btn-secondary'}`}
        >
          <AlertTriangle size={13} />
          Estoque baixo
        </button>
      </div>

      <DataTable
        columns={columns} data={products} pagination={pagination}
        onPageChange={setPage} loading={loading}
        emptyMessage="Nenhum produto cadastrado"
        emptyIcon={<Package size={20} className="text-gray-300" />}
      />

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); load(); }} title={selected ? 'Editar produto' : 'Novo produto'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="product-name" className="label">Nome *</label><input id="product-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required /></div>
          <div><label htmlFor="product-description" className="label">Descrição</label><textarea id="product-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="product-price" className="label">Preço de venda (R$) *</label><input id="product-price" type="number" step="0.01" min="0.01" value={form.price || ''} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="input" required /></div>
            <div><label htmlFor="product-cost" className="label">Preço de custo (R$)</label><input id="product-cost" type="number" step="0.01" min="0" value={form.costPrice || ''} onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} className="input" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label htmlFor="product-stock" className="label">Estoque *</label><input id="product-stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="input" required /></div>
            <div><label htmlFor="product-min-stock" className="label">Estoque mín.</label><input id="product-min-stock" type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} className="input" /></div>
            <div>
              <label htmlFor="product-unit" className="label">Unidade</label>
              <select id="product-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input">
                <option value="un">un</option><option value="kg">kg</option><option value="g">g</option>
                <option value="m">m</option><option value="l">l</option><option value="cx">cx</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="product-barcode" className="label">Código de barras</label><input id="product-barcode" type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input" /></div>
            <div><label htmlFor="product-category" className="label">Categoria</label><input id="product-category" type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" /></div>
          </div>
          <div>
            <span className="label">Imagens</span>
            <ImageUploader
              entityType="product"
              entityId={selected?.id}
              images={selected?.images}
              multiple
              disabled={!selected}
              onChange={(images) => selected && setSelected({ ...selected, images })}
            />
            {!selected && <p className="helper-text">Salve o produto para adicionar imagens.</p>}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
            <button type="button" onClick={() => { setModalOpen(false); load(); }} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting && <Spinner size={13} className="text-current" />}
              {selected ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Detalhes do produto" size="lg">
        {selected && (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="Nome" value={selected.name} />
              <Field label="Categoria" value={selected.category || '—'} />
              <Field label="Preço de venda" value={formatCurrency(selected.price)} />
              <Field label="Preço de custo" value={selected.costPrice != null ? formatCurrency(selected.costPrice) : '—'} />
              <Field
                label="Lucro unitário / Margem"
                value={selected.costPrice != null
                  ? `${formatCurrency(selected.price - selected.costPrice)} · ${(((selected.price - selected.costPrice) / selected.price) * 100).toFixed(0)}%`
                  : 'Cadastre o preço de custo'}
              />
              <Field
                label="Lucro unitário / Margem"
                value={selected.costPrice != null
                  ? `${formatCurrency(selected.price - selected.costPrice)} · ${(((selected.price - selected.costPrice) / selected.price) * 100).toFixed(0)}%`
                  : 'Cadastre o preço de custo'}
              />
              <Field label="Estoque" value={`${selected.stock} ${selected.unit}`} />
              <Field label="Estoque mínimo" value={`${selected.minStock} ${selected.unit}`} />
              <Field label="Código de barras" value={selected.barcode || '—'} mono />
              <Field label="Status" value={selected.active ? 'Ativo' : 'Inativo'} />
            </FieldGrid>
            {selected.description && <DetailSection title="Descrição"><p className="text-[13px] text-gray-700 dark:text-slate-300">{selected.description}</p></DetailSection>}
            <DetailSection title="Imagens">
              {selected.images && selected.images.length > 0 ? (
                <ImageGallery images={selected.images} />
              ) : (
                <p className="text-[13px] text-gray-400 dark:text-slate-500">Nenhuma imagem anexada.</p>
              )}
            </DetailSection>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Desativar produto" message={`Deseja desativar "${deleteTarget?.name}"? Ele não aparecerá mais nas vendas.`}
        confirmLabel="Desativar" variant="danger"
      />
    </div>
  );
}
