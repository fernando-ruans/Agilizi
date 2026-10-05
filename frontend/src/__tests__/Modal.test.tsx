import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, ConfirmDialog } from '../components/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Título">
        <p>Conteúdo</p>
      </Modal>
    );
    expect(screen.queryByText('Título')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Meu Modal">
        <p>Conteúdo aqui</p>
      </Modal>
    );
    expect(screen.getByText('Meu Modal')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo aqui')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Modal">
        <p>x</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Modal">
        <p>x</p>
      </Modal>
    );
    // The backdrop is the first child div with the fixed/absolute overlay
    const backdrop = document.querySelector('.fixed.inset-0 > div') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when X button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={onClose} title="Modal">
        <p>x</p>
      </Modal>
    );
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('shows message and both actions', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Excluir registro"
        message="Tem certeza?"
      />
    );
    expect(screen.getByText('Excluir registro')).toBeInTheDocument();
    expect(screen.getByText('Tem certeza?')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
    expect(screen.getByText('Confirmar')).toBeInTheDocument();
  });

  it('fires onConfirm when confirmed', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Excluir registro"
        message="Seguro?"
        confirmLabel="Excluir"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when cancelled', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={vi.fn()} title="X" message="Y" />
    );
    await user.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={vi.fn()} title="X" message="Y" />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
