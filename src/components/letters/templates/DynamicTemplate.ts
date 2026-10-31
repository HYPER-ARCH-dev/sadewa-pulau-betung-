import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { processDynamicTemplate } from '../../../utils/dynamicEngine';
import { getCleanPurpose } from '../sanitizer';

/**
 * GENERIC DYNAMIC TEMPLATE BUILDER
 * Digunakan untuk merender surat berdasarkan templateContent yang disimpan di DB/JSON.
 */
export function buildDynamicLetterTemplate(
  request: ServiceRequest,
  templateContent: string,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  // Gabungkan data request, data warga, dan data form untuk diproses template
  const templateData = {
    ...request,
    ...(request.formData || {}),
    villageName: vCtx?.villageName,
    subDistrict: vCtx?.subDistrict,
    regency: vCtx?.regency,
    headName: vCtx?.headName,
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  };

  const processedStatement = processDynamicTemplate(templateContent, templateData);

  return {
    title: request.serviceName.toUpperCase(),
    statement: processedStatement,
    purpose: getCleanPurpose(request, 'Keperluan Administrasi Umum'),
    customLetterNumber: request.officialLetterNumber
  };
}
