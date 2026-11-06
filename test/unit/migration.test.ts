import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';

describe('REQ-001 migration', () => {
  it('REQ-001 tạo đủ bảng users/sessions/spaces/pages/pages_fts trên :memory:', () => {
    const db = openDb(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE name IN ('users','sessions','spaces','pages','pages_fts')")
      .all()
      .map((r) => (r as { name: string }).name)
      .sort();
    expect(names).toEqual(['pages', 'pages_fts', 'sessions', 'spaces', 'users']);
  });
});
