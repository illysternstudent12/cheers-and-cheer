/*
 * node:sqlite stand-in for the static build, backed by sql.js (SQLite
 * compiled to WebAssembly). Call loadSqlite() once before opening a database.
 */
import initSqlJs, { type BindParams, type Database, type SqlJsStatic, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

let SQL: SqlJsStatic | undefined

export async function loadSqlite() {
  SQL ??= await initSqlJs({ locateFile: () => wasmUrl })
}

const norm = (args: unknown[]): BindParams =>
  args.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : (v as SqlValue)))

class Statement {
  private db: Database
  private sql: string
  constructor(db: Database, sql: string) {
    this.db = db
    this.sql = sql
  }
  get(...args: unknown[]) {
    const s = this.db.prepare(this.sql)
    try {
      s.bind(norm(args))
      return s.step() ? s.getAsObject() : undefined
    } finally {
      s.free()
    }
  }
  all(...args: unknown[]) {
    const s = this.db.prepare(this.sql)
    try {
      s.bind(norm(args))
      const rows: Record<string, SqlValue>[] = []
      while (s.step()) rows.push(s.getAsObject())
      return rows
    } finally {
      s.free()
    }
  }
  run(...args: unknown[]) {
    this.db.run(this.sql, norm(args))
    const changes = this.db.getRowsModified()
    const id = this.db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0
    return { changes, lastInsertRowid: Number(id) }
  }
}

export class DatabaseSync {
  readonly raw: Database
  constructor(_file?: string, bytes?: Uint8Array) {
    if (!SQL) throw new Error('loadSqlite() first')
    this.raw = new SQL.Database(bytes)
  }
  exec(sql: string) {
    this.raw.exec(sql)
  }
  prepare(sql: string) {
    return new Statement(this.raw, sql)
  }
}
