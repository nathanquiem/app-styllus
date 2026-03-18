const fs = require('fs');
const filePath = 'src/components/AuthModal.tsx';
let text = fs.readFileSync(filePath, 'utf-8');

text = text.replace(
  ".catch((e) => { console.warn('Fallback insert skipped:', e?.message) })",
  ".catch((e: unknown) => { console.warn('Fallback insert skipped:', (e as Error)?.message) })"
);

fs.writeFileSync(filePath, text, 'utf-8');
console.log('Fixed typescript catch error in', filePath);
