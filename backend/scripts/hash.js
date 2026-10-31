// Uso: npm run hash -- "tu clave"
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash -- "tu clave"');
  process.exit(1);
}
console.log(bcrypt.hashSync(password, 12));
