import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Beaker, Save, Eye, ClipboardList, Code } from 'lucide-react';
import { DynamicForm } from '../common/DynamicForm';
import { DynamicFieldSchema, processDynamicTemplate } from '../../utils/dynamicEngine';

/**
 * SADEWA DYNAMIC ENGINE PLAYGROUND
 * Halaman pengujian untuk fitur form dinamis dan template engine.
 */
export const TestDynamicForm: React.FC = () => {
  // 1. DUMMY SCHEMA: Surat Domisili Usaha
  const dummySchema: DynamicFieldSchema[] = [
    { 
      id: 'nama_usaha', 
      label: 'Nama Usaha', 
      type: 'text', 
      required: true, 
      placeholder: 'Contoh: Warung Barokah',
      helper: 'Masukkan nama lengkap usaha sesuai papan nama.'
    },
    { 
      id: 'jenis_usaha', 
      label: 'Jenis Usaha', 
      type: 'select', 
      options: ['Kuliner', 'Jasa', 'Dagang', 'Kerajinan', 'Pertanian'],
      required: true 
    },
    { 
      id: 'tahun_berdiri', 
      label: 'Tahun Berdiri', 
      type: 'number', 
      required: false,
      placeholder: '2024'
    },
    { 
      id: 'lokasi_detail', 
      label: 'Alamat Detail Usaha', 
      type: 'textarea', 
      required: true,
      placeholder: 'Jalan Lintas Desa KM 2...'
    }
  ];

  const dummyTemplate = "Menerangkan bahwa pemohon bernama {{citizenName}} memiliki usaha '{{nama_usaha}}' di bidang {{jenis_usaha}} yang berlokasi di {{lokasi_detail}}. Usaha ini telah berjalan sejak tahun {{tahun_berdiri}}.";

  const [formData, setFormData] = useState<Record<string, any>>({
    tahun_berdiri: '2024'
  });
  const [renderedResult, setRenderedResult] = useState<string>('');

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleTestRender = () => {
    const context = {
      ...formData,
      citizenName: 'Budi Santoso' // Mock user data
    };
    const result = processDynamicTemplate(dummyTemplate, context);
    setRenderedResult(result);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 bg-emerald-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <Beaker className="w-6 h-6 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dynamic Engine Playground</h1>
          <p className="text-xs text-emerald-200/70">Lingkungan pengujian aman untuk Form Dinamis & Template Surat</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Kolom Kiri: Form Input */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-800">1. Konfigurasi Input (JSON Schema)</h2>
          </div>
          
          <DynamicForm 
            schema={dummySchema}
            values={formData}
            onChange={handleFieldChange}
          />

          <button
            onClick={handleTestRender}
            className="w-full mt-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            <span>Test Render Template</span>
          </button>
        </div>

        {/* Kolom Kanan: Hasil & Debug */}
        <div className="space-y-6">
          {/* Preview Hasil */}
          <div className="bg-slate-900 text-slate-100 p-8 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <Save className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider">Hasil Render Naskah</h2>
            </div>
            
            <div className="min-h-[100px] text-sm leading-relaxed text-slate-300 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
              {renderedResult || <span className="text-slate-500 italic">Klik tombol di sebelah kiri untuk melihat hasil penggabungan template...</span>}
            </div>
          </div>

          {/* Debug Data */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-slate-600" />
              <h2 className="font-bold text-sm text-slate-800">Debug State Data (Payload)</h2>
            </div>
            <pre className="text-[10px] font-mono bg-slate-50 p-4 rounded-xl border border-slate-100 overflow-auto max-h-40">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
