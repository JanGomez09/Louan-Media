// Uso: npm run secret   → genera un valor aleatorio para JWT_SECRET
import { randomBytes } from 'node:crypto';
console.log(randomBytes(48).toString('hex'));
