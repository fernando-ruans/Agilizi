import type { Issuer } from './pdfReports';
import type { Company } from '../types';

export type PdfModule = typeof import('./pdfReports');

// pdfmake ships ~2MB of fonts — load it only when a PDF is generated
let pdfModule: PdfModule | null = null;
export async function getPdf(): Promise<PdfModule> {
  if (!pdfModule) pdfModule = await import('./pdfReports');
  return pdfModule;
}

/** Builds the issuer block (company name + contact) for any PDF. */
export function issuerFromCompany(company?: Company | null): Issuer {
  return {
    companyName: company?.name || 'Empresa',
    company: company
      ? {
          tradeName: company.tradeName,
          document: company.document,
          phone: company.phone,
          email: company.email,
          address: company.address,
          city: company.city,
          state: company.state,
          zipCode: company.zipCode,
        }
      : undefined,
  };
}
