import crypto from 'crypto';

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

const salt = "895eecb2b718bce62687b73c85f5aa11";
const password = "sadewa123";
console.log(hashPassword(password, salt));
