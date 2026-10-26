/**
 * Helper: prints a bcrypt hash for a password.
 * Usage:  npm run hash -- "Password123!"
 * Used to create the password_hash values in database/seed.sql.
 */
const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.log('Usage: npm run hash -- "YourPassword"');
  process.exit(1);
}

// 10 salt rounds is the common default: secure and still fast enough.
bcrypt.hash(password, 10).then((hash) => console.log(hash));
