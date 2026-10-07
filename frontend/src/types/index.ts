// ==========================================
// Image Types
// ==========================================

export interface Image {
  id: string;
  companyId: string;
  ownerType: 'product' | 'client' | 'supplier' | 'company' | 'user';
  ownerId: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Company Types
// ==========================================

export interface Company {
  id: string;
  name: string;
  tradeName?: string;
  document?: string;
  type: 'loja' | 'prestador' | 'ambos';
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  logo?: string;
  active: boolean;
  createdAt: string;
}

// ==========================================
// User Types
// ==========================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'gerente' | 'operacional';
  companyId: string;
  active: boolean;
  avatar?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// Menu Types
// ==========================================

export type CompanyType = 'loja' | 'prestador' | 'ambos';

export interface MenuItem {
  path: string;
  label: string;
  icon: string; // lucide icon name
  types: CompanyType[]; // which company types see this menu
}

// ==========================================
// Client Types
// ==========================================

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  documentType?: 'cpf' | 'cnpj';
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  images?: Image[];
}

// ==========================================
// Supplier Types
// ==========================================

export interface Supplier {
  id: string;
  name: string;
  companyName?: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  images?: Image[];
}

// ==========================================
// Service Types
// ==========================================

export interface Service {
  id: string;
  name: string;
  description?: string;
  value: number;
  category?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Budget Types
// ==========================================

export interface BudgetItem {
  id?: string;
  serviceId: string;
  serviceName?: string;
  description?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface Budget {
  id: string;
  number: number;
  clientId: string;
  client?: Client;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado' | 'convertido';
  totalValue: number;
  discount: number;
  notes?: string;
  validUntil?: string;
  items: BudgetItem[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Order Types
// ==========================================

export interface OrderItem {
  id?: string;
  serviceId: string;
  serviceName?: string;
  description?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface OrderStatusHistory {
  id: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  number: number;
  clientId: string;
  client?: Client;
  userId?: string;
  user?: User;
  description?: string;
  status: 'aberta' | 'em_andamento' | 'concluida' | 'cancelada';
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  startDate?: string;
  endDate?: string;
  totalValue: number;
  discount: number;
  notes?: string;
  items: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Cash Types
// ==========================================

export interface CashTransaction {
  id: string;
  type: 'entrada' | 'saida';
  category: string;
  description: string;
  value: number;
  date: string;
  paymentMethod?: string;
  reference?: string;
  userId?: string;
  user?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CashSummary {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  countEntradas: number;
  countSaidas: number;
}

// ==========================================
// Expense Types
// ==========================================

export interface Expense {
  id: string;
  description: string;
  value: number;
  category: string;
  date: string;
  dueDate?: string;
  paidDate?: string;
  status: 'pendente' | 'pago' | 'atrasado';
  paymentMethod?: string;
  supplierId?: string;
  supplier?: Supplier;
  userId?: string;
  user?: { id: string; name: string };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Dashboard Types
// ==========================================

export interface DashboardData {
  counts: {
    clients: number;
    suppliers: number;
    services: number;
    products: number;
  };
  products: {
    lowStock: number;
    lowStockList: { id: string; name: string; stock: number; minStock: number }[];
  };
  sales: {
    monthCount: number;
    monthValue: number;
    ticket: number;
    // Profit = revenue − cost (per-sale snapshot); null when no sales
    profit: number;
    marginPct: number | null;
    recent: Sale[];
  };
  orders: {
    byStatus: Record<string, number>;
    recent: Order[];
    currentMonth: {
      count: number;
      totalValue: number;
    };
  };
  cash: {
    monthly: {
      total: number;
      count: number;
    };
    yearly: {
      entradas: number;
      saidas: number;
      saldo: number;
    };
    series: { month: string; entradas: number; saidas: number }[];
  };
  expenses: {
    recent: Expense[];
    pending: {
      count: number;
      total: number;
    };
  };
}

// ==========================================
// Product Types (Loja)
// ==========================================

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  costPrice?: number;
  stock: number;
  minStock: number;
  barcode?: string;
  category?: string;
  unit: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  images?: Image[];
}

// ==========================================
// Sale Types (Loja)
// ==========================================

export interface SaleItem {
  id?: string;
  productId: string;
  productName?: string;
  product?: { id: string; name: string };
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface Sale {
  id: string;
  number: number;
  clientId?: string;
  client?: Client;
  userId?: string;
  user?: User;
  status: 'concluida' | 'cancelada';
  totalValue: number;
  discount: number;
  paymentMethod?: string;
  notes?: string;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// API Types
// ==========================================

export interface PaginationResponse<T> {
  status: 'success';
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  status: 'success';
  data: T;
  message?: string;
}

export interface LoginResponse {
  user: User;
  company: Company | null;
  token: string;
  refreshToken: string;
}
