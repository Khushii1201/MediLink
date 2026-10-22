const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = process.env.DB_PATH
  ? (path.isAbsolute(process.env.DB_PATH) ? process.env.DB_PATH : path.join(__dirname, process.env.DB_PATH))
  : path.join(__dirname, 'medilink.db');

const filesToDelete = [
  dbPath,
  `${dbPath}-shm`,
  `${dbPath}-wal`
];

for (const f of filesToDelete) {
  if (fs.existsSync(f)) {
    try {
      fs.unlinkSync(f);
      console.log(`Deleted: ${f}`);
    } catch (err) {
      console.error(`Error deleting ${f}: ${err.message}`);
    }
  }
}

console.log('Database reset. Reseeding...');
execSync(`node "${path.join(__dirname, 'seed.js')}"`, { stdio: 'inherit' });
console.log('Reset and seed completed.');
