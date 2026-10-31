/**
 * SADEWA DYNAMIC ENGINE
 * Utility untuk memproses template surat berbasis string (JSON/String Replacement).
 * Plug-and-play: Bisa digunakan di frontend maupun backend.
 */

export interface DynamicTemplateData {
  [key: string]: any;
}

/**
 * Memproses template string dengan mengganti placeholder {{key}} menjadi nilai dari data.
 * Contoh: "Halo {{nama}}" + { nama: "Budi" } => "Halo Budi"
 */
export function processDynamicTemplate(template: string, data: DynamicTemplateData): string {
  if (!template) return '';
  
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    // Dukungan nested key (misal: {{user.name}})
    const value = key.split('.').reduce((obj: any, i: string) => obj?.[i], data);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Contoh skema JSON untuk mendefinisikan form dinamis
 */
export interface DynamicFieldSchema {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  required: boolean;
  placeholder?: string;
  helper?: string;
}
