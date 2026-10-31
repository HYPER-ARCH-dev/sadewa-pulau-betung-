import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText } from '../sanitizer';

// Import seluruh 16 master template dokumen (15 layanan + kematian)
import { buildSkuTemplate } from './SkuTemplate';
import { buildSktmTemplate } from './SktmTemplate';
import { buildNikahTemplate } from './NikahTemplate';
import { buildSkckTemplate } from './SkckTemplate';
import { buildBedaNamaTemplate } from './BedaNamaTemplate';
import { buildBelumMenikahTemplate } from './BelumMenikahTemplate';
import { buildKehilanganTemplate } from './KehilanganTemplate';
import { buildKematianTemplate } from './KematianTemplate';
import { buildKelahiranTemplate } from './KelahiranTemplate';
import { buildDomisiliTemplate } from './DomisiliTemplate';
import { buildAhliWarisTemplate } from './AhliWarisTemplate';
import { buildSporadikTemplate } from './SporadikTemplate';
import { buildPindahDomisiliTemplate } from './PindahDomisiliTemplate';
import { buildJandaDudaTemplate } from './JandaDudaTemplate';
import { buildPenghasilanOrtuTemplate } from './PenghasilanOrtuTemplate';
import { buildBelumMemilikiRumahTemplate } from './BelumMemilikiRumahTemplate';
import { buildRekomendasiCamatTemplate } from './RekomendasiCamatTemplate';
import { buildPengantarDisdukcapilTemplate } from './PengantarDisdukcapilTemplate';
import { buildRekomendasiDinsosTemplate } from './RekomendasiDinsosTemplate';
import { buildRekomendasiProvinsiTemplate } from './RekomendasiProvinsiTemplate';

export * from './SkuTemplate';
export * from './SktmTemplate';
export * from './NikahTemplate';
export * from './SkckTemplate';
export * from './BedaNamaTemplate';
export * from './BelumMenikahTemplate';
export * from './KehilanganTemplate';
export * from './KematianTemplate';
export * from './KelahiranTemplate';
export * from './DomisiliTemplate';
export * from './AhliWarisTemplate';
export * from './SporadikTemplate';
export * from './PindahDomisiliTemplate';
export * from './JandaDudaTemplate';
export * from './PenghasilanOrtuTemplate';
export * from './BelumMemilikiRumahTemplate';
export * from './RekomendasiCamatTemplate';
export * from './PengantarDisdukcapilTemplate';
export * from './RekomendasiDinsosTemplate';
export * from './RekomendasiProvinsiTemplate';

/**
 * MASTER TEMPLATE RESOLVER
 * Menentukan template surat dinas resmi berdasarkan ID layanan, nama layanan, dan data formulir pemohon.
 * Memastikan ke-15 menu layanan publik terpetakan ke 18 format dokumen aktual (termasuk bundel N1-N4).
 * Keyword: OFFICIAL_LETTER, TEMPLATE_RESOLVER
 */
export function resolveLetterTemplate(
  request: ServiceRequest,
  defaultPrintDate: string,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const sId = (request.serviceId || '').toLowerCase().trim();
  const sName = (request.serviceName || '').toLowerCase().trim();
  const eventType = sanitizeText(request.formData?.event_type, '').toLowerCase().trim();

  // 1. Surat Pernyataan Penguasaan Fisik Bidang Tanah (SPORADIK) - Kelas A
  if (
    sId === 'srv-sporadik' ||
    sName.includes('sporadik') ||
    sName.includes('penguasaan fisik') ||
    (sName.includes('tanah') && !sName.includes('rumah'))
  ) {
    return buildSporadikTemplate(request, vCtx);
  }

  // 2. Surat Keterangan Ahli Waris - Kelas A
  if (
    sId === 'srv-ahli-waris' ||
    sName.includes('ahli waris') ||
    sName.includes('warisan') ||
    sName.includes('silsilah waris')
  ) {
    return buildAhliWarisTemplate(request, vCtx);
  }

  // 3. Surat Keterangan Pindah Domisili (SKPWNI Pengantar) - Kelas A
  if (
    sId === 'srv-pindah-domisili' ||
    sName.includes('pindah') ||
    sName.includes('skpwni') ||
    sName.includes('perpindahan penduduk')
  ) {
    return buildPindahDomisiliTemplate(request, vCtx);
  }

  // 4. Surat Keterangan Status Janda / Duda - Kelas A
  if (
    sId === 'srv-janda-duda' ||
    sName.includes('janda') ||
    sName.includes('duda')
  ) {
    return buildJandaDudaTemplate(request, vCtx);
  }

  // 5. Surat Keterangan Penghasilan Orang Tua - Kelas B
  if (
    sId === 'srv-penghasilan-ortu' ||
    sName.includes('penghasilan') ||
    sName.includes('gaji orang tua') ||
    sName.includes('penghasilan wali')
  ) {
    return buildPenghasilanOrtuTemplate(request, vCtx);
  }

  // 6. Surat Keterangan Belum Memiliki Rumah - Kelas B
  if (
    sId === 'srv-belum-memiliki-rumah' ||
    sName.includes('belum memiliki rumah') ||
    sName.includes('belum punya rumah') ||
    sName.includes('kpr')
  ) {
    return buildBelumMemilikiRumahTemplate(request, vCtx);
  }

  // 7. Paket Pengantar Nikah (Bundel Model N1 - N4 Kemenag) - Kelas A
  if (
    sId === 'srv-6' ||
    sId === 'srv-nikah-bundle' ||
    sName.includes('nikah') ||
    sName.includes('kua') ||
    sName.includes('perkawinan') ||
    sName.includes('n1')
  ) {
    return buildNikahTemplate(request, vCtx);
  }

  // 8. Surat Keterangan Usaha (SKU) - Kelas A
  if (
    sId === 'srv-1' ||
    sId === 'srv-sku' ||
    sName.includes('usaha') ||
    sName.includes('sku')
  ) {
    return buildSkuTemplate(request, vCtx);
  }

  // 9. Surat Keterangan Beda Nama / Identitas - Kelas A
  if (
    sId === 'srv-7' ||
    sId === 'srv-beda-nama' ||
    sName.includes('beda nama') ||
    sName.includes('identitas')
  ) {
    return buildBedaNamaTemplate(request, vCtx);
  }

  // 10. Surat Pengantar Kehilangan (Polsek) - Kelas A
  if (
    sId === 'srv-9' ||
    sId === 'srv-kehilangan' ||
    sName.includes('hilang') ||
    sName.includes('kehilangan')
  ) {
    return buildKehilanganTemplate(request, vCtx);
  }

  // 11. Surat Keterangan Tidak Mampu (SKTM) - Kelas B
  if (
    sId === 'srv-4' ||
    sId === 'srv-sktm' ||
    sName.includes('tidak mampu') ||
    sName.includes('sktm')
  ) {
    return buildSktmTemplate(request, vCtx);
  }

  // 12. Surat Pengantar Catatan Kepolisian (SKCK) - Kelas B
  if (
    sId === 'srv-3' ||
    sId === 'srv-skck' ||
    sName.includes('skck') ||
    sName.includes('kepolisian') ||
    sName.includes('catatan kepolisian')
  ) {
    return buildSkckTemplate(request, vCtx);
  }

  // 13. Surat Keterangan Belum Menikah (Lajang) - Kelas B
  if (
    sId === 'srv-8' ||
    sId === 'srv-belum-menikah' ||
    sName.includes('belum nikah') ||
    sName.includes('belum kawin') ||
    sName.includes('lajang')
  ) {
    return buildBelumMenikahTemplate(request, vCtx);
  }

  // 14. Surat Keterangan Kematian (Peristiwa Kematian)
  if (
    eventType.includes('mati') ||
    eventType.includes('kematian') ||
    (sName.includes('kematian') && !sName.includes('kelahiran')) ||
    sName.includes('meninggal')
  ) {
    return buildKematianTemplate(request, defaultPrintDate, vCtx);
  }

  // 15. Surat Keterangan Kelahiran - Kelas B
  if (
    sId === 'srv-5' ||
    sId === 'srv-kelahiran' ||
    eventType.includes('lahir') ||
    eventType.includes('kelahiran') ||
    sName.includes('lahir') ||
    sName.includes('kelahiran')
  ) {
    return buildKelahiranTemplate(request, defaultPrintDate, vCtx);
  }

  // 16. Template Inter-Instansi: Rekomendasi Camat / Kecamatan
  if (sId === 'srv-rec-camat' || sId.includes('rec-camat') || sName.includes('rekomendasi camat')) {
    return buildRekomendasiCamatTemplate(request, vCtx);
  }

  // 17. Template Inter-Instansi: Layanan Adduk Disdukcapil Kabupaten
  if (sId === 'srv-rec-disdukcapil' || sId.includes('rec-disdukcapil') || sName.includes('adduk disdukcapil')) {
    return buildPengantarDisdukcapilTemplate(request, vCtx);
  }

  // 18. Template Inter-Instansi: Rekomendasi Dinas Sosial / BPJS PBI
  if (sId === 'srv-rec-dinsos' || sId.includes('rec-dinsos') || sName.includes('rekomendasi dinas sosial')) {
    return buildRekomendasiDinsosTemplate(request, vCtx);
  }

  // 19. Template Inter-Instansi: Pengantar Usulan / Program Provinsi
  if (sId === 'srv-rec-provinsi' || sId.includes('rec-provinsi') || sName.includes('usulan provinsi')) {
    return buildRekomendasiProvinsiTemplate(request, vCtx);
  }

  // 20. Default Fallback: Surat Keterangan Domisili (SKD) - Kelas B
  return buildDomisiliTemplate(request, vCtx);
}

