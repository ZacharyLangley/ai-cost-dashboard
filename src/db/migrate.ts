import fs from 'fs';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './client.js';

fs.mkdirSync('./data', { recursive: true });
fs.mkdirSync('./drizzle', { recursive: true });

migrate(db, { migrationsFolder: './drizzle' });

console.log('Migration complete');
sqlite.close();
