import fs from 'fs';
const filePath = './src/components/public/LetterForm.tsx';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/<(input|select|textarea)([^>]*?)className="([^"]*?)"([^>]*?)>/g, (match, tag, before, cls, after) => {
  let newCls = cls;
  if (!newCls.includes('text-slate-')) {
    newCls += ' text-slate-950 font-medium';
  }
  if (!newCls.includes('bg-')) {
    newCls += ' bg-white';
  }
  if (!newCls.includes('placeholder:')) {
    newCls += ' placeholder:text-slate-400';
  }
  return `<${tag}${before}className="${newCls.trim()}"${after}>`;
});

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated form inputs in LetterForm.tsx');
