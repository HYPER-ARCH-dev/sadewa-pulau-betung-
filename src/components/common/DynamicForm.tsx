import React from 'react';
import { DynamicFieldSchema } from '../../utils/dynamicEngine';

interface DynamicFormProps {
  schema: DynamicFieldSchema[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  errors?: Record<string, string>;
}

/**
 * GENERIC DYNAMIC FORM COMPONENT
 * n-Layanan, 1-Komponen. Merender input berdasarkan JSON schema.
 */
export const DynamicForm: React.FC<DynamicFormProps> = ({ schema, values, onChange, errors }) => {
  return (
    <div className="space-y-4">
      {schema.map((field) => (
        <div key={field.id} className="flex flex-col gap-1.5">
          <label htmlFor={field.id} className="text-sm font-semibold text-slate-700">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          
          {field.type === 'textarea' ? (
            <textarea
              id={field.id}
              className={`px-4 py-2.5 rounded-xl border ${errors?.[field.id] ? 'border-red-500' : 'border-slate-200'} focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              placeholder={field.placeholder}
              value={values[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              rows={3}
            />
          ) : field.type === 'select' ? (
            <select
              id={field.id}
              className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
              value={values[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
            >
              <option value="">Pilih {field.label}</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              id={field.id}
              type={field.type}
              className={`px-4 py-2.5 rounded-xl border ${errors?.[field.id] ? 'border-red-500' : 'border-slate-200'} focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              placeholder={field.placeholder}
              value={values[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          )}
          
          {field.helper && <p className="text-[11px] text-slate-500 italic">{field.helper}</p>}
          {errors?.[field.id] && <p className="text-xs text-red-500 font-medium">{errors[field.id]}</p>}
        </div>
      ))}
    </div>
  );
};
