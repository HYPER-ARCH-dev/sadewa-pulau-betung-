const fs = require('fs');

let content = fs.readFileSync('src/data/letterClassification.ts', 'utf-8');

// Add documentClass?: 'A' | 'B'; to interface LetterFormatConfig
content = content.replace(
  "category: LetterClass;",
  "category: LetterClass;\n  documentClass?: 'A' | 'B';"
);

// We need to set documentClass for all items. We can use a replacer.
content = content.replace(/id:\s*'([^']+)'([^}]+)category:\s*'[^']+'/g, (match, id, middle) => {
  let docClass = 'B';
  if (['srv-sporadik', 'srv-ahli-waris', 'srv-sku', 'srv-penghasilan-ortu', 'srv-nikah-bundle'].includes(id)) {
    docClass = 'A';
  }
  return `id: '${id}'${middle}category: '${docClass === 'A' ? 'CLASS_A' : 'CLASS_B'}',\n    documentClass: '${docClass}'`;
});

fs.writeFileSync('src/data/letterClassification.ts', content);
