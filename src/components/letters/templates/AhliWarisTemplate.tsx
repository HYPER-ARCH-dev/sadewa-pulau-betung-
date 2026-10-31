import React from 'react';
import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext, LetterPageDetails } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * Master Template untuk Surat Keterangan Ahli Waris (Multi-Page Bundle)
 * Lembar 1: Surat Keterangan Resmi dari Desa (Kop & TTD Kepala Desa + QR)
 * Lembar 2: Surat Pernyataan Ahli Waris & Silsilah Lengkap (Tabel + Slot TTD Seluruh Ahli Waris & Saksi)
 * Keyword: OFFICIAL_LETTER, AHLI_WARIS_TEMPLATE
 */
export function buildAhliWarisTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const formData = (request.formData || {}) as Record<string, any>;

  const deceasedName = sanitizeText(
    formData.deceased_name || formData.nama_pewaris || formData.nama_almarhum,
    '-'
  );
  const deceasedNik = sanitizeText(
    formData.nik_pewaris || formData.nik_almarhum,
    '-'
  );
  const deathDate = sanitizeText(
    formData.tanggal_meninggal_pewaris || formData.tanggal_meninggal || formData.tgl_kematian,
    '-'
  );
  const deathPlace = sanitizeText(
    formData.tempat_meninggal_pewaris || formData.tempat_meninggal || '-',
    '-'
  );

  // Parse Heirs List from JSON
  let heirs: any[] = [];
  if (formData.heirs_list_json) {
    try {
      heirs = JSON.parse(formData.heirs_list_json);
    } catch {
      heirs = [];
    }
  }

  // Fallback to unstructured text if JSON parsing fails but text exists
  if (heirs.length === 0 && (formData.heirs_list || request.citizenName)) {
    const textFallback = String(formData.heirs_list || request.citizenName);
    heirs = [{
      name: textFallback,
      nik: request.citizenNik || '-',
      birthPlaceDate: `${request.citizenBirthPlace || '-'}, ${request.citizenBirthDate || '-'}`,
      relationship: 'Pemohon / Ahli Waris',
      status: 'Hidup'
    }];
  }

  const printDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Construct Lembar I (Surat Keterangan Kades)
  const page1: LetterPageDetails = {
    pageNumber: 1,
    pageCode: 'LEMBAR I - REGISTER DESA',
    title: 'SURAT KETERANGAN AHLI WARIS',
    subtitle: 'Keterangan Silsilah Ahli Waris dari Desa',
    statement: `Berdasarkan silsilah keluarga, kesaksian saksi, serta dokumen kependudukan resmi desa, menerangkan bahwa Almarhum/Almarhumah beserta daftar ahli waris sah yang tercantum di bawah ini adalah benar warga Desa Pulau Betung:`,
    extraFields: [],
    purpose: getCleanPurpose(
      request,
      'Administrasi klaim tabungan bank, pengalihan sertifikat hak milik pertanahan (sporadik), klaim BPJS Ketenagakerjaan/Kematian, dan keperluan administrasi keluarga lainnya.'
    ),
    signType: 'kades',
    renderCustom: () => (
      <div className="mt-2 font-sans text-xs">
        {/* IDENTITAS PEWARIS / ALMARHUM - COMPACT CARD */}
        <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="font-bold text-slate-800 mb-1 uppercase tracking-wide text-[9px] text-rose-700">
            Identitas Pewaris / Almarhum:
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
            {/* Kolom Kiri: Nama & NIK */}
            <div className="space-y-1">
              <div className="grid grid-cols-[110px_auto_1fr] border-b border-slate-100 pb-0.5">
                <span className="text-slate-600">Nama Pewaris</span>
                <span className="text-slate-600">:</span>
                <span className="font-bold text-slate-900 pl-2">{deceasedName}</span>
              </div>
              <div className="grid grid-cols-[110px_auto_1fr]">
                <span className="text-slate-600">NIK Pewaris</span>
                <span className="text-slate-600">:</span>
                <span className="font-bold text-slate-900 font-mono text-[10px] pl-2">{deceasedNik}</span>
              </div>
            </div>

            {/* Kolom Kanan: Tanggal & Tempat Wafat */}
            <div className="space-y-1">
              <div className="grid grid-cols-[110px_auto_1fr] border-b border-slate-100 pb-0.5">
                <span className="text-slate-600">Tanggal Wafat</span>
                <span className="text-slate-600">:</span>
                <span className="font-bold text-slate-900 pl-2">{deathDate}</span>
              </div>
              <div className="grid grid-cols-[110px_auto_1fr]">
                <span className="text-slate-600">Tempat Wafat</span>
                <span className="text-slate-600">:</span>
                <span className="font-bold text-slate-900 pl-2">{deathPlace}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DAFTAR AHLI WARIS TABLE - EXTRA COMPACT */}
        <p className="font-bold text-slate-800 mb-1 uppercase tracking-wide text-[9px] text-emerald-800">
          I. Daftar Nama Ahli Waris yang Terdaftar & Sah:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold text-[9px] uppercase">
                <th className="border border-slate-300 py-1 px-1.5 text-center w-8">No</th>
                <th className="border border-slate-300 py-1 px-1.5">Nama Lengkap Ahli Waris</th>
                <th className="border border-slate-300 py-1 px-1.5 w-32">NIK</th>
                <th className="border border-slate-300 py-1 px-1.5">Tempat / Tanggal Lahir</th>
                <th className="border border-slate-300 py-1 px-1.5">Hubungan Keluarga</th>
                <th className="border border-slate-300 py-1 px-1.5 text-center w-16">Status</th>
              </tr>
            </thead>
            <tbody className="text-[10px]">
              {heirs.map((h, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="border border-slate-300 py-1 px-1.5 text-center font-mono font-bold text-slate-600">{i + 1}</td>
                  <td className="border border-slate-300 py-1 px-1.5 font-bold text-slate-900">{h.name || '-'}</td>
                  <td className="border border-slate-300 py-1 px-1.5 font-mono text-slate-700">{h.nik || '-'}</td>
                  <td className="border border-slate-300 py-1 px-1.5 text-slate-800">{h.birthPlaceDate || '-'}</td>
                  <td className="border border-slate-300 py-1 px-1.5 font-medium text-slate-700">{h.relationship || '-'}</td>
                  <td className="border border-slate-300 py-1 px-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      h.status === 'Hidup'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {h.status || 'Hidup'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  };

  // Construct Lembar II (Surat Pernyataan & Bagan Silsilah)
  const page2: LetterPageDetails = {
    pageNumber: 2,
    pageCode: 'LEMBAR II - PERNYATAAN & SILSILAH',
    title: 'SURAT PERNYATAAN & SILSILAH WARIS',
    subtitle: 'Pernyataan Mutlak dan Tanggung Jawab Hukum Para Ahli Waris',
    statement: `Kami yang bertanda tangan di bawah ini selaku seluruh ahli waris kandung yang sah dari almarhum/almarhumah [${deceasedName}] dengan ini menyatakan dengan sadar dan sesungguhnya, bahwa silsilah kekeluargaan dan daftar ahli waris yang kami cantumkan adalah benar dan mutlak tanpa ada ahli waris lain yang disembunyikan. Apabila di kemudian hari timbul perselisihan, klaim, atau gugatan hukum dari pihak ketiga, kami bertanggung jawab penuh secara hukum pidana maupun perdata tanpa melibatkan pihak Kelurahan / Pemerintah Desa Pulau Betung.`,
    signType: 'none', // Handle signatures directly inside renderCustom for pristine custom layouts
    renderCustom: () => (
      <div className="mt-4 font-sans text-xs space-y-4">
        <div>
          <p className="font-bold text-slate-800 mb-1.5 uppercase tracking-wide text-[9px] text-emerald-800">
            II. Bagan & Tanda Tangan Mutlak Seluruh Ahli Waris:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-[9px] uppercase">
                  <th className="border border-slate-300 p-1.5 text-center w-8">No</th>
                  <th className="border border-slate-300 p-1.5">Nama Ahli Waris</th>
                  <th className="border border-slate-300 p-1.5">Hubungan Keluarga</th>
                  <th className="border border-slate-300 p-1.5 text-center w-40">Tanda Tangan / Jempol</th>
                  <th className="border border-slate-300 p-1.5">Keterangan Dokumen</th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {heirs.map((h, i) => (
                  <tr key={i} className="h-12">
                    <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-slate-600">{i + 1}</td>
                    <td className="border border-slate-300 p-1.5">
                      <div className="font-bold text-slate-900">{h.name || '-'}</div>
                      <div className="text-[9px] text-slate-500 font-mono">NIK: {h.nik || '-'}</div>
                    </td>
                    <td className="border border-slate-300 p-1.5 font-medium text-slate-700">{h.relationship || '-'}</td>
                    <td className="border border-slate-300 p-1.5 text-center relative font-mono text-[10px] text-slate-400 bg-slate-50/50">
                      <div className="absolute top-1 left-2 text-[8px] text-slate-400 font-black">{i + 1}.</div>
                      <div className="h-10" />
                    </td>
                    <td className="border border-slate-300 p-1.5 text-slate-600 text-[9px] leading-relaxed">
                      Saksi keluarga menyatakan hak waris penuh secara murni dan sadar.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION III & LEGALISASI WRAPPER - FORCE PAGE BREAK TOGETHER IF NEEDED */}
        <div 
          className="break-inside-avoid block mt-4"
          style={{
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
            display: 'block'
          }}
        >
          {/* Section Saksi Tetangga & Keluarga */}
          <div className="pt-2">
            <p className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-[10px] text-slate-600">
              III. Kesaksian Saksi-Saksi Pendukung:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Saksi I (Ketua RT / Tetangga Sebelah)
                </span>
                <p className="font-bold text-slate-800 text-xs">Nama Jelas RT:</p>
                <div className="h-10 mt-2"></div>
              </div>
              <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Saksi II (Tokoh Masyarakat Desa)
                </span>
                <p className="font-bold text-slate-800 text-xs">Nama Jelas Tokoh:</p>
                <div className="h-10 mt-2"></div>
              </div>
            </div>
          </div>

          {/* Legalisasi Kepala Desa Terpadu */}
          <div className="pt-4 mt-4 border-t border-slate-200">
            <div className="grid grid-cols-12 gap-3 text-center text-xs">
              <div className="col-span-4 space-y-1">
                <p className="font-bold text-slate-700 uppercase tracking-wide text-[9px]">Saksi Keluarga Utama:</p>
                <p className="font-semibold text-slate-800">Mewakili Pihak Keluarga</p>
                <div className="h-12 flex items-center justify-center relative">
                  <div className="absolute border-2 border-slate-200 border-dashed p-1 w-[60px] h-[30px] text-[8px] flex items-center justify-center text-slate-200 font-bold -rotate-12 left-6">
                    MATERAI
                  </div>
                </div>
                <p className="font-bold underline text-slate-900">{request.citizenName}</p>
                <p className="text-[9px] text-slate-500 font-mono">NIK: {request.citizenNik}</p>
              </div>

              <div className="col-span-4 space-y-1">
                <p className="font-bold text-slate-700 uppercase tracking-wide text-[9px]">MENGETAHUI:</p>
                <p className="font-semibold text-slate-800">Ketua BPD Pulau Betung</p>
                <div className="h-12" />
                <p className="font-bold underline text-slate-900">................................................</p>
                <p className="text-[9px] text-slate-500 font-semibold">(Ketua BPD)</p>
              </div>

              <div className="col-span-4 space-y-1">
                <p className="font-bold text-slate-500 text-[10px]">Pulau Betung, {printDate}</p>
                <p className="font-bold text-slate-800 uppercase tracking-wide text-[9px]">Kepala Desa Pulau Betung</p>
                <div className="h-12" />
                <p className="font-bold underline text-slate-950 uppercase">{ctx.headName}</p>
                {ctx.headNip && <p className="text-[9px] text-slate-500 font-mono">NIP: {ctx.headNip}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  };

  return {
    title: 'SURAT KETERANGAN AHLI WARIS',
    statement: `Menyatakan silsilah para ahli waris almarhum/almarhumah ${deceasedName} sesuai dengan berkas hukum resmi.`,
    extraFields: [
      { label: 'Nama Pewaris (Almarhum)', value: deceasedName },
      { label: 'Total Ahli Waris Sah', value: `${heirs.length} Orang` }
    ],
    purpose: request.notes || 'Persyaratan administratif permohonan penetapan ahli waris, penutupan/pengalihan rekening tabungan bank, pengurusan aset tanah/bangunan, dan jaminan sosial ketenagakerjaan.',
    isBundle: true,
    pages: [page1, page2]
  };
}
