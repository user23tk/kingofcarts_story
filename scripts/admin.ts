import { db } from '../src/db.js';

const args = process.argv.slice(2);
if (args.includes('--smoke')) {
  console.log('smoke test');
  process.exit(0);
}

const cmd = args[0];
const userId = Number(args[1]);
if (!cmd || !userId) {
  console.log('Usage: ban|unban <userId>');
  process.exit(1);
}

if (cmd === 'ban') {
  db.prepare('UPDATE users SET banned=1 WHERE id=?').run(userId);
  console.log('banned', userId);
} else if (cmd === 'unban') {
  db.prepare('UPDATE users SET banned=0 WHERE id=?').run(userId);
  console.log('unbanned', userId);
} else {
  console.log('unknown command');
  process.exit(1);
}
