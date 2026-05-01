import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const dbPath = env.DATABASE_URL.replace(/^file:/, '');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const sqlite = new Database(dbPath);
// Harden file permissions immediately after creation (macOS default umask creates at 644)
try { fs.chmodSync(dbPath, 0o600); } catch {}

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('temp_store = MEMORY');
// Overwrite deleted content when cheap — minimal overhead, helps if backups are unencrypted
sqlite.pragma('secure_delete = FAST');

export const db = drizzle(sqlite, { schema });

export type DrizzleDb = typeof db;
