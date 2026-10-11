import duckdb from "duckdb";
import path from "node:path";

const DB_PATH = path.resolve("explorer_v2.duckdb");

export type DB = {
	instance: duckdb.Database;
	conn: duckdb.Connection;
	run: (sql: string) => Promise<void>;
	all: <T = Record<string, unknown>>(sql: string) => Promise<T[]>;
};

function promisifyDb(db: duckdb.Database, conn: duckdb.Connection): DB {
	return {
		instance: db,
		conn,
		run(sql: string): Promise<void> {
			return new Promise((resolve, reject) => {
				conn.run(sql, (err: Error | null) => {
					if (err) reject(err);
					else resolve();
				});
			});
		},
		all<T = Record<string, unknown>>(sql: string): Promise<T[]> {
			return new Promise((resolve, reject) => {
				conn.all(sql, (err: Error | null, rows: any[]) => {
					if (err) reject(err);
					else resolve(rows as T[]);
				});
			});
		},
	};
}

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS characters (
	id VARCHAR PRIMARY KEY,
	account VARCHAR,
	name VARCHAR,
	league VARCHAR,
	class VARCHAR,
	base_class INTEGER,
	level INTEGER,
	life INTEGER,
	energy_shield INTEGER,
	mana INTEGER,
	spirit INTEGER,
	evasion_rating INTEGER,
	armour INTEGER,
	fire_res INTEGER,
	cold_res INTEGER,
	lightning_res INTEGER,
	chaos_res INTEGER,
	effective_hp INTEGER,
	keystones JSON,
	source_file VARCHAR
);

CREATE TABLE IF NOT EXISTS items (
	id VARCHAR,
	character_id VARCHAR,
	item_slot INTEGER,
	inventory_id VARCHAR,
	name VARCHAR,
	base_type VARCHAR,
	type_line VARCHAR,
	rarity VARCHAR,
	ilvl INTEGER,
	corrupted BOOLEAN,
	fractured BOOLEAN,
	desecrated BOOLEAN,
	quality INTEGER,
	req_type VARCHAR,
	explicit_mods JSON,
	fractured_mods JSON,
	crafted_mods JSON,
	enchant_mods JSON,
	desecrated_mods JSON,
	rune_mods JSON,
	implicit_mods JSON,
	mods_json JSON,
	sockets JSON,
	requirements JSON,
	properties JSON
);

CREATE TABLE IF NOT EXISTS skills (
	character_id VARCHAR,
	skill_name VARCHAR,
	support_gems JSON,
	dps DOUBLE,
	level INTEGER,
	quality INTEGER
);

CREATE TABLE IF NOT EXISTS flasks (
	character_id VARCHAR,
	base_type VARCHAR,
	rarity VARCHAR,
	explicit_mods JSON
);
`;

export async function initDb(): Promise<DB> {
	const db = new duckdb.Database(DB_PATH);
	const conn = db.connect();
	const wrapped = promisifyDb(db, conn);

	// Create tables
	for (const stmt of SCHEMA_DDL.split(";").filter((s) => s.trim())) {
		await wrapped.run(stmt + ";");
	}

	console.log(`DuckDB initialized at ${DB_PATH}`);
	return wrapped;
}
