const fs = require('fs');

let content = fs.readFileSync('src/components/letters/templates/SporadikTemplate.tsx', 'utf-8');

const target1 = `  const sporadikMode = formData.sporadik_mode || 'manual';
  const boundaries = JSON.parse(formData.sporadik_boundaries || '[]');
  
  const landLocation = sanitizeText(formData.land_location || formData.letak_tanah, request.addressDusun || 'Wilayah Desa Pulau Betung');
  const landArea = sanitizeText(formData.land_area || formData.luas_tanah, '± 1.000 m²');
  const landSource = sanitizeText(formData.land_source || formData.asal_tanah, 'Penggarapan / Warisan / Jual Beli Tanah Desa');`;

const repl1 = `  const sporadikMode = formData.sporadik_mode || 'manual';
  const boundaries = JSON.parse(formData.sporadik_boundaries || '[]');
  const cadastral = calculateCadastralData(boundaries, 800, 600);
  
  const landLocation = sanitizeText(formData.land_location || formData.letak_tanah, request.addressDusun || 'Wilayah Desa Pulau Betung');
  let finalArea = sanitizeText(formData.land_area || formData.luas_tanah, '± 1.000 m²');
  
  if (sporadikMode === 'gps' && cadastral.area > 0) {
    finalArea = \`± \${cadastral.area.toLocaleString('id-ID', {maximumFractionDigits: 2})} m²\`;
  }
  
  const landSource = sanitizeText(formData.land_source || formData.asal_tanah, 'Penggarapan / Warisan / Jual Beli Tanah Desa');
  
  const boundaryFields = boundaries.map((b: any) => ({
    label: \`Batas \${b.direction || '...'}\`,
    value: \`\${b.neighbor || '...'} (± \${b.length || '0'} m)\`
  }));`;

content = content.replace(target1, repl1);

const target2 = `      statement: 'Saya yang bertanda tangan di bawah ini menyatakan bahwa saya dengan itikad baik telah menguasai dan mengusahakan sebidang tanah yang terletak di ' + landLocation + ' seluas ' + landArea + ', diperoleh dari ' + landSource + '. Penguasaan tanah ini bebas sengketa.',
      signType: 'pemohon',
    },
    {
      pageNumber: 2,
      pageCode: 'LEMBAR 2',
      title: 'SURAT KETERANGAN PENGESAHAN KEPALA DESA',
      subtitle: 'Pengesahan atas Pernyataan Penguasaan Fisik Tanah',
      statement: 'Pemerintah Desa Pulau Betung dengan ini menerangkan dan mengesahkan bahwa pernyataan pemohon di atas adalah benar sesuai dengan pengamatan fisik dan catatan administratif desa.',
      signType: 'kades',`;

const repl2 = `      statement: 'Saya yang bertanda tangan di bawah ini menyatakan bahwa saya dengan itikad baik telah menguasai dan mengusahakan sebidang tanah yang terletak di ' + landLocation + ' seluas ' + finalArea + ', diperoleh dari ' + landSource + '. Penguasaan tanah ini bebas sengketa dengan batas-batas sempadan sebagai berikut:',
      extraFields: boundaryFields,
      signType: 'pemohon',
    },
    {
      pageNumber: 2,
      pageCode: 'LEMBAR 2',
      title: 'SURAT KETERANGAN PENGESAHAN KEPALA DESA',
      subtitle: 'Pengesahan atas Pernyataan Penguasaan Fisik Tanah',
      statement: 'Pemerintah Desa Pulau Betung dengan ini menerangkan dan mengesahkan bahwa pernyataan pemohon di atas adalah benar. Sebidang tanah yang terletak di ' + landLocation + ' seluas ' + finalArea + ' dengan batas-batas sempadan sebagai berikut adalah benar dikuasai oleh pemohon.',
      extraFields: boundaryFields,
      signType: 'kades',`;

content = content.replace(target2, repl2);

const target3 = `                        <text y="14" textAnchor="middle" className="text-[12px] fill-slate-800 font-semibold" style={{ textShadow: '1px 1px 3px white, -1px -1px 3px white, 1px -1px 3px white, -1px 1px 3px white' }}>
                          {p1.direction || 'Batas'} • {p1.length || '0'}m
                        </text>`;

const repl3 = `                        <text y="14" textAnchor="middle" className="text-[12px] fill-slate-800 font-semibold" style={{ textShadow: '1px 1px 3px white, -1px -1px 3px white, 1px -1px 3px white, -1px 1px 3px white' }}>
                          {p1.direction || 'Batas'} • {p1.length || '0'} m
                        </text>`;

content = content.replace(target3, repl3);

const target4 = `      renderCustom: () => {
        const cadastral = calculateCadastralData(boundaries, 800, 600);`;
const repl4 = `      renderCustom: () => {`;
content = content.replace(target4, repl4);

fs.writeFileSync('src/components/letters/templates/SporadikTemplate.tsx', content);
