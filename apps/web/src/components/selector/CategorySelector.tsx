import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tag, AlertCircle } from 'lucide-react';
import { CategoryService } from '../../services/category.service';
import type { CategoryDTO } from '@telegram-forwarder/shared';

export interface CategorySelectorProps {
  selectedCategoryId: string | null;
  onChange: (categoryId: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  className?: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  onChange,
  disabled = false,
  required = false,
  error = null,
  className = '',
}) => {
  const { data: categories = [], isLoading } = useQuery<CategoryDTO[]>({
    queryKey: ['categories'],
    queryFn: () => CategoryService.list('active'),
  });

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-sky-400" />
          Content Category {required && <span className="text-rose-400">*</span>}
        </span>
        <span className="text-[10px] lowercase font-normal text-slate-500">
          (What is this content about?)
        </span>
      </label>

      {isLoading ? (
        <div className="h-9 rounded-lg bg-slate-900 border border-slate-800 animate-pulse" />
      ) : (
        <select
          value={selectedCategoryId || ''}
          onChange={(e) => onChange(e.target.value ? e.target.value : null)}
          disabled={disabled}
          className={`w-full px-3 py-2 text-xs bg-slate-900/90 border rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors ${
            error
              ? 'border-rose-500/60 focus:border-rose-500'
              : 'border-slate-800 focus:border-sky-500'
          }`}
        >
          <option value="" className="bg-slate-900 text-slate-400">
            Select a category...
          </option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id} className="bg-slate-900 text-slate-200">
              {cat.iconEmoji ? `${cat.iconEmoji} ` : ''}
              {cat.displayName || cat.name}
            </option>
          ))}
        </select>
      )}

      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
};
