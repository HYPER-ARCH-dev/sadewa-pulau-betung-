import fs from 'fs';
import path from 'path';

function getAllFiles(dir: string, exts = ['.tsx', '.ts']): string[] {
  let res: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      res = res.concat(getAllFiles(full, exts));
    } else if (exts.includes(path.extname(e.name))) {
      res.push(full);
    }
  }
  return res;
}

const hooks = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer'];
const files = getAllFiles('./src');
const issues: Array<{ file: string; hook: string; count: number; lines: number[] }> = [];

for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const lines = code.split('\n');
  
  // Collect all named imports from 'react'
  const importedNamedHooks = new Set<string>();
  const reactImportLines = lines.filter(l => l.includes("from 'react'") || l.includes('from "react"'));
  
  for (const line of reactImportLines) {
    const match = line.match(/{([^}]*)}/);
    if (match) {
      match[1].split(',').forEach(s => {
        const clean = s.trim().split(/\s+as\s+/)[0].trim();
        if (clean) importedNamedHooks.add(clean);
      });
    }
  }

  for (const hook of hooks) {
    const lineMatches: number[] = [];
    lines.forEach((lineText, idx) => {
      // Ignore import lines or comment lines
      if (lineText.trim().startsWith('//') || lineText.trim().startsWith('/*') || lineText.includes('from ')) return;
      
      // Look for bare hook usage like `useState(` or `useState<` but NOT `React.useState`
      // We check with regex:
      const regex = new RegExp(`(^|[^a-zA-Z0-9_$.])${hook}\\s*[<(]`);
      if (regex.test(lineText)) {
        lineMatches.push(idx + 1);
      }
    });

    if (lineMatches.length > 0 && !importedNamedHooks.has(hook)) {
      issues.push({ file: f, hook, count: lineMatches.length, lines: lineMatches });
    }
  }
}

console.log('=== AUDIT HOOKS RESULT ===');
if (issues.length === 0) {
  console.log('NO MISSING HOOK IMPORTS FOUND ACROSS ALL SRC FILES!');
} else {
  console.log(`Found ${issues.length} potential issue(s):`);
  console.log(JSON.stringify(issues, null, 2));
}
