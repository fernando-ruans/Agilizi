import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '../components/DataTable';

const rows = [
  { id: '1', name: 'Cliente Um', email: 'um@x.com' },
  { id: '2', name: 'Cliente Dois', email: 'dois@x.com' },
];

const columns = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email' },
];

describe('DataTable', () => {
  it('renders column headers and rows', () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Cliente Um')).toBeInTheDocument();
    expect(screen.getByText('dois@x.com')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading', () => {
    const { container } = render(<DataTable columns={columns} data={[]} loading />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nome')).not.toBeInTheDocument();
  });

  it('shows empty state with custom message', () => {
    render(
      <DataTable columns={columns} data={[]} emptyMessage="Nenhum cliente cadastrado" />
    );
    expect(screen.getByText('Nenhum cliente cadastrado')).toBeInTheDocument();
  });

  it('renders no pagination controls when there is only one page', () => {
    render(
      <DataTable columns={columns} data={rows} pagination={{ total: 2, page: 1, limit: 10, totalPages: 1 }} />
    );
    // Whole footer is skipped when totalPages <= 1
    expect(screen.queryByText(/de 2/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onPageChange when paging', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        pagination={{ total: 25, page: 2, limit: 10, totalPages: 3 }}
        onPageChange={onPageChange}
      />
    );

    const buttons = screen.getAllByRole('button');
    // prev and next are the only buttons in the footer
    const next = buttons[buttons.length - 1];
    const prev = buttons[buttons.length - 2];

    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(prev);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables prev on first page and next on last page', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns} data={rows} pagination={{ total: 25, page: 1, limit: 10, totalPages: 3 }} onPageChange={onPageChange} />
    );
    let buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 2]).toBeDisabled();

    rerender(
      <DataTable columns={columns} data={rows} pagination={{ total: 25, page: 3, limit: 10, totalPages: 3 }} onPageChange={onPageChange} />
    );
    buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it('invokes custom cell renderers', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', label: 'Nome' },
          { key: 'name', label: 'Destaque', className: 'col-mark', render: (item: any) => <strong>{item.name}!</strong> },
        ]}
        data={rows}
      />
    );
    expect(screen.getByText('Cliente Um!')).toBeInTheDocument();
  });
});
