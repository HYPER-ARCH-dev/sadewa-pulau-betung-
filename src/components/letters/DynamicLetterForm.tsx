import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserX,
  MapPin,
  FileText,
  DollarSign,
  Users,
  Briefcase,
  Home,
  Heart,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  HelpCircle,
  FileCheck,
  ChevronDown
} from 'lucide-react';
import {
  LetterFormSchema,
  FormFieldSchema,
  getLetterFormSchema,
  getDefaultFormData,
  validateFormData
} from './letterFormSchemas';

export interface DynamicLetterFormProps {
  /** Slug/Kode jenis surat (misal: 'surat-kematian', 'sporadik', 'sk-beda-nama', 'sktm', 'sk-ahli-waris', 'sku') */
  letterCodeOrSlug?: string;
  /** Schema khusus jika ingin di-override langsung dari parent */
  customSchema?: LetterFormSchema;
  /** Initial values untuk autofill/edit mode */
  initialData?: Record<string, any>;
  /** Callback perubahan data dan status validasi */
  onChange?: (formData: Record<string, any>, isValid: boolean) => void;
  /** Callback saat form disubmit */
  onSubmit?: (payload: {
    letterCode: string;
    title: string;
    formData: Record<string, any>;
  }) => void;
  /** Mode readonly / pratinjau saja */
  readOnly?: boolean;
  /** Tampilkan tombol submit bawaan komponen */
  showSubmitButton?: boolean;
  /** Label kustom pada tombol submit */
  submitButtonText?: string;
  /** Status loading/submitting */
  isSubmitting?: boolean;
  /** Class CSS tambahan pada container */
  className?: string;
}

/** Mapping Icon Lucide berdasarkan nama icon pada schema */
const ICON_MAP: Record<string, React.ElementType> = {
  UserX,
  MapPin,
  FileText,
  DollarSign,
  Users,
  Briefcase,
  Home,
  Heart,
  Calendar,
  Clock,
  FileCheck
};

/**
 * Format Angka menjadi Rupiah IDR untuk tipe input currency
 */
function formatRupiahInput(value: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  const cleanStr = String(value).replace(/[^0-9]/g, '');
  if (!cleanStr) return '';
  const num = parseInt(cleanStr, 10);
  return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Unformat Rupiah String kembali menjadi Angka Murni String
 */
function unformatRupiah(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export const DynamicLetterForm: React.FC<DynamicLetterFormProps> = ({
  letterCodeOrSlug,
  customSchema,
  initialData,
  onChange,
  onSubmit,
  readOnly = false,
  showSubmitButton = true,
  submitButtonText = 'Simpan & Lanjutkan Pengajuan',
  isSubmitting = false,
  className = ''
}) => {
  // Resolve schema berdasarkan slug atau customSchema
  const schema: LetterFormSchema = useMemo(() => {
    if (customSchema) return customSchema;
    return getLetterFormSchema(letterCodeOrSlug);
  }, [letterCodeOrSlug, customSchema]);

  // State nilai-nilai input form
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const defaults = getDefaultFormData(schema);
    return { ...defaults, ...(initialData || {}) };
  });

  // State error validasi per field
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset form state saat schema berubah
  useEffect(() => {
    const defaults = getDefaultFormData(schema);
    const merged = { ...defaults, ...(initialData || {}) };
    setFormData(merged);
    setErrors({});
    setTouched({});
  }, [schema, initialData]);

  // Lakukan validasi dan panggil onChange secara teratur
  const handleValidateAndNotify = useCallback(
    (currentData: Record<string, any>) => {
      const currentErrors = validateFormData(schema, currentData);
      setErrors(currentErrors);
      const isValid = Object.keys(currentErrors).length === 0;
      if (onChange) {
        onChange(currentData, isValid);
      }
    },
    [schema, onChange]
  );

  // Update field value tunggal
  const handleFieldChange = (fieldId: string, value: any) => {
    if (readOnly) return;
    const nextData = { ...formData, [fieldId]: value };
    setFormData(nextData);
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
    handleValidateAndNotify(nextData);
  };

  // Blur handler untuk mentrigger visual error
  const handleBlur = (fieldId: string) => {
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
  };

  // Handler Array Repeater (Tambah elemen baru)
  const handleAddArrayItem = (field: FormFieldSchema) => {
    if (readOnly) return;
    const currentList = Array.isArray(formData[field.id]) ? [...formData[field.id]] : [];
    if (field.arrayMaxItems && currentList.length >= field.arrayMaxItems) return;

    const newItem: Record<string, any> = {};
    if (field.arrayFields) {
      field.arrayFields.forEach((sub) => {
        newItem[sub.id] = sub.defaultValue || '';
      });
    }

    const nextList = [...currentList, newItem];
    const nextData = { ...formData, [field.id]: nextList };
    setFormData(nextData);
    handleValidateAndNotify(nextData);
  };

  // Handler Array Repeater (Hapus elemen)
  const handleRemoveArrayItem = (field: FormFieldSchema, index: number) => {
    if (readOnly) return;
    const currentList = Array.isArray(formData[field.id]) ? [...formData[field.id]] : [];
    if (field.arrayMinItems && currentList.length <= field.arrayMinItems) return;

    currentList.splice(index, 1);
    const nextData = { ...formData, [field.id]: currentList };
    setFormData(nextData);
    handleValidateAndNotify(nextData);
  };

  // Handler Array Repeater (Edit sub-field item)
  const handleArraySubFieldChange = (
    fieldId: string,
    itemIndex: number,
    subFieldId: string,
    value: any
  ) => {
    if (readOnly) return;
    const currentList = Array.isArray(formData[fieldId]) ? [...formData[fieldId]] : [];
    if (!currentList[itemIndex]) currentList[itemIndex] = {};

    currentList[itemIndex] = {
      ...currentList[itemIndex],
      [subFieldId]: value
    };

    const nextData = { ...formData, [fieldId]: currentList };
    setFormData(nextData);
    handleValidateAndNotify(nextData);
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    // Tandai semua field sebagai touched untuk menampilkan pesan error
    const allTouched: Record<string, boolean> = {};
    schema.groups.forEach((g) => {
      g.fields.forEach((f) => {
        allTouched[f.id] = true;
      });
    });
    setTouched(allTouched);

    const validationErrors = validateFormData(schema, formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // Gulir otomatis ke error pertama
      const firstErrorKey = Object.keys(validationErrors)[0];
      const errorElement = document.getElementById(`field-container-${firstErrorKey}`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (onSubmit) {
      onSubmit({
        letterCode: schema.letterCode,
        title: schema.title,
        formData
      });
    }
  };

  const HeaderIcon = (schema.iconName && ICON_MAP[schema.iconName]) || FileCheck;

  // Class penentu layout grid responsive
  const getGridColClass = (gridCol?: 'full' | 'half' | 'third') => {
    switch (gridCol) {
      case 'half':
        return 'col-span-12 md:col-span-6';
      case 'third':
        return 'col-span-12 sm:col-span-6 md:col-span-4';
      case 'full':
      default:
        return 'col-span-12';
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6 ${className}`}
    >
      {/* HEADER UTAMA SURAT */}
      <div className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex-shrink-0">
          <HeaderIcon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            {schema.title}
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
              {schema.letterCode.toUpperCase()}
            </span>
          </h3>
          {schema.description && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {schema.description}
            </p>
          )}
        </div>
      </div>

      {/* GRUP INPUT FIELD */}
      {schema.groups.map((group, groupIdx) => (
        <div
          key={`group-${groupIdx}`}
          className="space-y-4 pt-2 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 pb-4 last:pb-0"
        >
          {(group.groupTitle || group.groupDescription) && (
            <div className="bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              {group.groupTitle && (
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {group.groupTitle}
                </h4>
              )}
              {group.groupDescription && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {group.groupDescription}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            {group.fields.map((field) => {
              const fieldError = touched[field.id] ? errors[field.id] : undefined;
              const value = formData[field.id];

              // RENDER KHUSUS TIPE REPEATER ARRAY (e.g. AHLI WARIS)
              if (field.type === 'array') {
                const arrayData: Record<string, any>[] = Array.isArray(value) ? value : [];

                return (
                  <div
                    key={field.id}
                    id={`field-container-${field.id}`}
                    className="col-span-12 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        {field.label}
                        {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <span className="text-xs text-slate-500 font-mono">
                        {arrayData.length} Data Terdaftar
                      </span>
                    </div>

                    {/* DAFTAR CARD ITEMS */}
                    <div className="space-y-3">
                      {arrayData.map((item, itemIdx) => {
                        const itemLabel = (field.arrayItemLabel || 'Data Ke-{index}').replace(
                          '{index}',
                          String(itemIdx + 1)
                        );

                        return (
                          <div
                            key={`arr-item-${itemIdx}`}
                            className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 sm:p-4 relative space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] flex items-center justify-center font-bold">
                                  {itemIdx + 1}
                                </span>
                                {itemLabel}
                              </span>
                              {!readOnly &&
                                arrayData.length > (field.arrayMinItems || 1) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveArrayItem(field, itemIdx)}
                                    className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2 py-1 rounded-lg transition flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Hapus
                                  </button>
                                )}
                            </div>

                            {/* SUB FIELDS */}
                            <div className="grid grid-cols-12 gap-3">
                              {field.arrayFields?.map((subF) => {
                                const subVal = item[subF.id] || '';
                                const subErrorKey = `${field.id}.${itemIdx}.${subF.id}`;
                                const subError = touched[field.id] ? errors[subErrorKey] : undefined;

                                return (
                                  <div
                                    key={subF.id}
                                    className={getGridColClass(subF.gridCol)}
                                  >
                                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                      {subF.label}
                                      {subF.required && <span className="text-rose-500">*</span>}
                                    </label>

                                    {subF.type === 'select' ? (
                                      <div className="relative">
                                        <select
                                          value={subVal}
                                          disabled={readOnly}
                                          onChange={(e) =>
                                            handleArraySubFieldChange(
                                              field.id,
                                              itemIdx,
                                              subF.id,
                                              e.target.value
                                            )
                                          }
                                          className={`w-full text-xs rounded-lg px-3 py-2 border bg-white dark:bg-slate-900 appearance-none text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                                            subError
                                              ? 'border-rose-400 focus:ring-rose-200'
                                              : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                                          }`}
                                        >
                                          <option value="">-- Pilih --</option>
                                          {subF.options?.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        disabled={readOnly}
                                        value={subVal}
                                        placeholder={subF.placeholder}
                                        onChange={(e) =>
                                          handleArraySubFieldChange(
                                            field.id,
                                            itemIdx,
                                            subF.id,
                                            e.target.value
                                          )
                                        }
                                        className={`w-full text-xs rounded-lg px-3 py-2 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                                          subError
                                            ? 'border-rose-400 focus:ring-rose-200'
                                            : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                                        }`}
                                      />
                                    )}

                                    {subError && (
                                      <p className="text-[10px] text-rose-500 mt-0.5 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                        {subError}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* TOMBOL TAMBAH ITEM */}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleAddArrayItem(field)}
                        className="w-full py-2 px-3 border border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Data {field.label} Baru
                      </button>
                    )}

                    {fieldError && (
                      <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {fieldError}
                      </p>
                    )}
                  </div>
                );
              }

              // RENDER FIELD SINGLE REGULER
              return (
                <div
                  key={field.id}
                  id={`field-container-${field.id}`}
                  className={`${getGridColClass(field.gridCol)} space-y-1`}
                >
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {field.label}
                    {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                  </label>

                  {/* SELECT INPUT */}
                  {field.type === 'select' && (
                    <div className="relative">
                      <select
                        disabled={readOnly}
                        value={value || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        onBlur={() => handleBlur(field.id)}
                        className={`w-full text-xs sm:text-sm rounded-xl px-3.5 py-2.5 border bg-white dark:bg-slate-900 appearance-none text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                          fieldError
                            ? 'border-rose-400 focus:ring-rose-200 dark:border-rose-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                        }`}
                      >
                        <option value="">-- Pilih {field.label} --</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    </div>
                  )}

                  {/* TEXTAREA INPUT */}
                  {field.type === 'textarea' && (
                    <textarea
                      disabled={readOnly}
                      rows={3}
                      value={value || ''}
                      placeholder={field.placeholder}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      onBlur={() => handleBlur(field.id)}
                      className={`w-full text-xs sm:text-sm rounded-xl p-3 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                        fieldError
                          ? 'border-rose-400 focus:ring-rose-200 dark:border-rose-500'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                      }`}
                    />
                  )}

                  {/* CURRENCY INPUT */}
                  {field.type === 'currency' && (
                    <div className="relative">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={formatRupiahInput(value)}
                        placeholder={field.placeholder || 'Rp 0'}
                        onChange={(e) => {
                          const rawNum = unformatRupiah(e.target.value);
                          handleFieldChange(field.id, rawNum ? parseInt(rawNum, 10) : '');
                        }}
                        onBlur={() => handleBlur(field.id)}
                        className={`w-full text-xs sm:text-sm rounded-xl px-3.5 py-2.5 border bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                          fieldError
                            ? 'border-rose-400 focus:ring-rose-200 dark:border-rose-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  )}

                  {/* DATE INPUT */}
                  {field.type === 'date' && (
                    <div className="relative">
                      <input
                        type="date"
                        disabled={readOnly}
                        value={value || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        onBlur={() => handleBlur(field.id)}
                        className={`w-full text-xs sm:text-sm rounded-xl px-3.5 py-2.5 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                          fieldError
                            ? 'border-rose-400 focus:ring-rose-200 dark:border-rose-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  )}

                  {/* TIME INPUT */}
                  {field.type === 'time' && (
                    <div className="relative">
                      <input
                        type="time"
                        disabled={readOnly}
                        value={value || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        onBlur={() => handleBlur(field.id)}
                        className={`w-full text-xs sm:text-sm rounded-xl px-3.5 py-2.5 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                          fieldError
                            ? 'border-rose-400 focus:ring-rose-200 dark:border-rose-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  )}

                  {/* NUMBER INPUT */}
                  {field.type === 'number' && (
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        disabled={readOnly}
                        value={value ?? ''}
                        placeholder={field.placeholder}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        onBlur={() => handleBlur(field.id)}
                        className={`w-full text-xs sm:text-sm rounded-xl px-3.5 py-2.5 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                          field.unit ? 'pr-14' : ''
                        } ${
                          fieldError
                            ? 'border-rose-400 focus:ring-rose-200 dark:border-rose-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                        }`}
                      />
                      {field.unit && (
                        <span className="absolute right-3.5 text-xs text-slate-500 font-medium pointer-events-none">
                          {field.unit}
                        </span>
                      )}
                    </div>
                  )}

                  {/* STANDARD TEXT INPUT */}
                  {field.type === 'text' && (
                    <input
                      type="text"
                      disabled={readOnly}
                      value={value || ''}
                      placeholder={field.placeholder}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      onBlur={() => handleBlur(field.id)}
                      className={`w-full text-xs sm:text-sm rounded-xl px-3.5 py-2.5 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition ${
                        fieldError
                          ? 'border-rose-400 focus:ring-rose-200 dark:border-rose-500'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500'
                      }`}
                    />
                  )}

                  {/* HELPER TEXT */}
                  {field.helpText && !fieldError && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      {field.helpText}
                    </p>
                  )}

                  {/* ERROR MESSAGE */}
                  {fieldError && (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fieldError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* FOOTER TOMBOL SUBMIT */}
      {!readOnly && showSubmitButton && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses Data...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitButtonText}</span>
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
};

export default DynamicLetterForm;
