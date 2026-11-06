import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb } from '../db/index.js';
import { buildApp } from './app.js';

const dbPath = process.env.DB_PATH ?? './data/app.db';
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
const app = buildApp(openDb(dbPath));
const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  console.error(err);
  process.exit(1);
});
