/* ============================================================
   Toolbox Code Playground — SQLite worker (sql.js)

   One database per worker. The page opens it from a workspace file
   (or empty / in-memory), runs statements, and gets the file bytes
   back afterwards so `sqlite3 app.db` persists like the real CLI.

   page → worker  { type:'open', sqljsBase, bytes? }
                  { type:'exec', sql, id }       → { type:'result', id, sets:[{columns, values}], changes, error? }
                  { type:'export', id }          → { type:'bytes', id, bytes }
   ============================================================ */
'use strict';

var SQL = null;
var db = null;

function send(m, transfer) { self.postMessage(m, transfer || []); }

async function ensure(base) {
  if (SQL) return SQL;
  importScripts(base + 'sql-wasm.js');
  SQL = await self.initSqlJs({ locateFile: function (f) { return base + f; } });
  return SQL;
}

self.onmessage = async function (e) {
  var m = e.data || {};
  try {
    if (m.type === 'open') {
      await ensure(m.sqljsBase);
      if (db) db.close();
      db = m.bytes && m.bytes.length ? new SQL.Database(m.bytes) : new SQL.Database();
      db.run('PRAGMA foreign_keys = ON;');
      send({ type: 'opened', id: m.id });
      return;
    }
    if (m.type === 'exec') {
      if (!db) throw new Error('No database is open.');
      var sets = [];
      var changes = 0;
      var error = null;
      var errorStatement = null;
      // Run statement by statement so results and errors line up with the source.
      var it = db.iterateStatements(m.sql);
      for (;;) {
        var stmt;
        try { var n = it.next(); if (n.done) break; stmt = n.value; } catch (err) { error = String(err && err.message || err); errorStatement = it.getRemainingSQL ? it.getRemainingSQL().trim().split('\n')[0] : null; break; }
        try {
          var columns = stmt.getColumnNames();
          var rows = [];
          while (stmt.step()) rows.push(stmt.get());
          if (columns.length) sets.push({ columns: columns, values: rows, sql: stmt.getSQL() });
          else changes += db.getRowsModified();
        } catch (err) {
          error = String(err && err.message || err);
          errorStatement = stmt.getSQL();
          stmt.free();
          break;
        }
        stmt.free();
      }
      send({ type: 'result', id: m.id, sets: sets, changes: changes, error: error, errorStatement: errorStatement });
      return;
    }
    if (m.type === 'export') {
      var bytes = db ? db.export() : new Uint8Array(0);
      send({ type: 'bytes', id: m.id, bytes: bytes }, [bytes.buffer]);
      return;
    }
  } catch (err) {
    send({ type: 'result', id: m.id, sets: [], changes: 0, error: String(err && err.message || err) });
  }
};
send({ type: 'ready' });
