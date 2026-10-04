import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  const iconMap = {
    danger: <Trash2 className="w-5 h-5 text-rose-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    primary: <HelpCircle className="w-5 h-5 text-sky-400" />,
  };

  const buttonVariantMap: Record<
    'danger' | 'warning' | 'primary',
    'danger' | 'primary' | 'secondary'
  > = {
    danger: 'danger',
    warning: 'primary',
    primary: 'primary',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#111c33] border border-white/[0.08]">
            {iconMap[variant]}
          </div>
          <span className="font-semibold text-slate-100">{title}</span>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto justify-center">
            {cancelText}
          </Button>
          <Button
            variant={buttonVariantMap[variant]}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            className="w-full sm:w-auto justify-center"
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="text-sm text-slate-300 leading-relaxed">{description}</div>
    </Modal>
  );
};
