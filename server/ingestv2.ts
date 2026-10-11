/**
 * Optimized ingestion using batch inserts and parallel file parsing.
 * Writes to explorer_v2.duckdb (does NOT touch live DB).
 *
 * Usage: npm run ingest:v2
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import fs from "fs-extra";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import duckdb from "duckdb";

const __filename = fileURLToPath(import.meta.url);
const DEFAULT_DATA_ROOT = path.resolve("..", "scraper", "data", "poe.ninja");
const DB_PATH = path.resolve("explorer_v2.duckdb"); // DEBUG: separate DB
const BATCH_SIZE = 200;
const NUM_WORKERS = 8;

function sha1(s: string): string {
	return crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function escSql(s: string): string {
	return s.replace(/'/g, "''");
}

function toJsonLiteral(val: unknown): string {
	if (val === null || val === undefined) return "NULL";
	return `'${escSql(JSON.stringify(val))}'`;
}

function toBool(val: unknown): string {
	return val ? "TRUE" : "FALSE";
}

function toInt(val: unknown): string {
	const n = Number(val);
	return Number.isFinite(n) ? String(Math.round(n)) : "0";
}

function computeReqType(requirements: any[]): string {
	if (!Array.isArray(requirements)) return "";
	const has = { str: false, dex: false, int: false };
	for (const req of requirements) {
		const type = req?.type;
		if (type === 63) has.str = true;
		else if (type === 64) has.dex = true;
		else if (type === 65) has.int = true;
	}
	const parts: string[] = [];
	if (has.str) parts.push("str");
	if (has.dex) parts.push("dex");
	if (has.int) parts.push("int");
	return parts.join("_") || "";
}

// Types for parsed results from workers
type ParsedChar = {
	charValues: string;
	itemValues: string[];
	skillValues: string[];
	flaskValues: string[];
};

function parseFile(filePath: string): ParsedChar | null {
	let data: any;
	try {
		data = JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}

	if (!data.class || !Array.isArray(data.items)) return null;

	const charId = sha1(`${data.account ?? ""}/${data.name ?? ""}`);
	const ds = data.defensiveStats ?? {};

	const charValues = `(
		'${escSql(charId)}','${escSql(String(data.account ?? ""))}','${escSql(String(data.name ?? ""))}',
		'${escSql(String(data.league ?? ""))}','${escSql(String(data.class ?? ""))}',${toInt(data.baseClass)},
		${toInt(data.level)},${toInt(ds.life)},${toInt(ds.energyShield)},${toInt(ds.mana)},
		${toInt(ds.spirit)},${toInt(ds.evasionRating)},${toInt(ds.armour)},${toInt(ds.fireResistance)},
		${toInt(ds.coldResistance)},${toInt(ds.lightningResistance)},${toInt(ds.chaosResistance)},
		${toInt(ds.effectiveHealthPool)},${toJsonLiteral((data.keystones ?? []).map((k: any) => k.name ?? ""))},
		'${escSql(filePath)}'
	)`;

	const itemValues: string[] = [];
	const allItems = [...(data.items ?? []), ...(data.jewels ?? []), ...(data.flasks ?? [])];

	for (const item of allItems) {
		const d = item?.itemData;
		if (!d) continue;
		const itemId = d.id ?? sha1(JSON.stringify(d).slice(0, 200));

		itemValues.push(`(
			'${escSql(itemId)}','${escSql(charId)}',${toInt(item.itemSlot)},
			'${escSql(String(d.inventoryId ?? ""))}','${escSql(String(d.name ?? ""))}',
			'${escSql(String(d.baseType ?? ""))}','${escSql(String(d.typeLine ?? ""))}',
			'${escSql(String(d.rarity ?? d.frameTypeId ?? ""))}',${toInt(d.ilvl)},
			${toBool(d.corrupted)},${toBool(d.fractured)},${toBool(d.desecrated)},
			${toInt(d.qualityProperty)},'${escSql(computeReqType(d.requirements))}',
			${toJsonLiteral(d.explicitMods ?? [])},${toJsonLiteral(d.fracturedMods ?? [])},
			${toJsonLiteral(d.craftedMods ?? [])},${toJsonLiteral(d.enchantMods ?? [])},
			${toJsonLiteral(d.desecratedMods ?? [])},${toJsonLiteral(d.runeMods ?? [])},
			${toJsonLiteral(d.implicitMods ?? [])},${toJsonLiteral(d.mods ?? null)},
			${toJsonLiteral(d.sockets ?? [])},${toJsonLiteral(d.requirements ?? [])},
			${toJsonLiteral(d.properties ?? [])}
		)`);
	}

	const skillValues: string[] = [];
	for (const skill of data.skills ?? []) {
		const allGems = skill.allGems ?? [];
		const mainGem = allGems[0];
		if (!mainGem) continue;
		const supports = allGems
			.slice(1)
			.filter((g: any) => g.itemData?.support)
			.map((g: any) => g.name ?? "");
		const dps = skill.dps?.[0]?.dps ?? 0;

		skillValues.push(`(
			'${escSql(charId)}','${escSql(String(mainGem.name ?? ""))}',
			${toJsonLiteral(supports)},${Number(dps) || 0},${toInt(mainGem.level)},${toInt(mainGem.quality)}
		)`);
	}

	// Flasks already in allItems, skip separate flask table
	return { charValues, itemValues, skillValues, flaskValues: [] };
}

// ─── WORKER THREAD ───────────────────────────────────────────────
if (!isMainThread) {
	const files: string[] = workerData.files;
	const results: ParsedChar[] = [];

	for (const f of files) {
		const parsed = parseFile(f);
		if (parsed) results.push(parsed);
	}

	parentPort!.postMessage(results);
} else {
	// ─── MAIN THREAD ───────────────────────────────────────────────
	async function findAllJsonFiles(dataRoot: string): Promise<string[]> {
		const result: string[] = [];
		const folders = await fs.readdir(dataRoot, { withFileTypes: true });
		for (const folder of folders) {
			if (!folder.isDirectory()) continue;
			const capturesDir = path.join(dataRoot, folder.name, "captures");
			if (!(await fs.pathExists(capturesDir))) continue;
			const files = await fs.readdir(capturesDir);
			for (const f of files) {
				if (f.endsWith(".json")) result.push(path.join(capturesDir, f));
			}
		}
		return result;
	}

	function runWorker(files: string[]): Promise<ParsedChar[]> {
		return new Promise((resolve, reject) => {
			const worker = new Worker(__filename, { workerData: { files } });
			worker.on("message", resolve);
			worker.on("error", reject);
		});
	}

	const SCHEMA_DDL = `
		CREATE TABLE IF NOT EXISTS characters (
			id VARCHAR PRIMARY KEY, account VARCHAR, name VARCHAR, league VARCHAR,
			class VARCHAR, base_class INTEGER, level INTEGER, life INTEGER,
			energy_shield INTEGER, mana INTEGER, spirit INTEGER, evasion_rating INTEGER,
			armour INTEGER, fire_res INTEGER, cold_res INTEGER, lightning_res INTEGER,
			chaos_res INTEGER, effective_hp INTEGER, keystones JSON, source_file VARCHAR
		);
		CREATE TABLE IF NOT EXISTS items (
			id VARCHAR, character_id VARCHAR, item_slot INTEGER, inventory_id VARCHAR,
			name VARCHAR, base_type VARCHAR, type_line VARCHAR, rarity VARCHAR,
			ilvl INTEGER, corrupted BOOLEAN, fractured BOOLEAN, desecrated BOOLEAN,
			quality INTEGER, req_type VARCHAR, explicit_mods JSON, fractured_mods JSON,
			crafted_mods JSON, enchant_mods JSON, desecrated_mods JSON, rune_mods JSON,
			implicit_mods JSON, mods_json JSON, sockets JSON, requirements JSON, properties JSON
		);
		CREATE TABLE IF NOT EXISTS skills (
			character_id VARCHAR, skill_name VARCHAR, support_gems JSON,
			dps DOUBLE, level INTEGER, quality INTEGER
		);
		CREATE TABLE IF NOT EXISTS flasks (
			character_id VARCHAR, base_type VARCHAR, rarity VARCHAR, explicit_mods JSON
		);
	`;

	async function main() {
		const dataRoot = process.argv[2] || DEFAULT_DATA_ROOT;
		console.log(`[v2] Scanning: ${dataRoot}`);
		const startTime = Date.now();

		const files = await findAllJsonFiles(dataRoot);
		console.log(`[v2] Found ${files.length} JSON files, using ${NUM_WORKERS} workers`);

		if (!files.length) {
			console.error("No JSON files found.");
			process.exit(1);
		}

		// Split files across workers
		const chunks: string[][] = Array.from({ length: NUM_WORKERS }, () => []);
		files.forEach((f, i) => chunks[i % NUM_WORKERS].push(f));

		// Parse in parallel
		console.log("[v2] Parsing files in parallel...");
		const parseStart = Date.now();
		const workerResults = await Promise.all(chunks.map(runWorker));
		const allParsed = workerResults.flat();
		console.log(
			`[v2] Parsed ${allParsed.length} characters in ${Date.now() - parseStart}ms`,
		);

		// Setup DB
		console.log(`[v2] Writing to: ${DB_PATH}`);
		await fs.remove(DB_PATH);
		const db = new duckdb.Database(DB_PATH);
		const conn = db.connect();

		const run = (sql: string): Promise<void> =>
			new Promise((res, rej) =>
				conn.run(sql, (err: Error | null) => (err ? rej(err) : res())),
			);

		for (const stmt of SCHEMA_DDL.split(";").filter((s) => s.trim())) {
			await run(stmt + ";");
		}

		// Batch insert characters
		console.log("[v2] Inserting characters...");
		for (let i = 0; i < allParsed.length; i += BATCH_SIZE) {
			const batch = allParsed.slice(i, i + BATCH_SIZE);
			const values = batch.map((p) => p.charValues).join(",");
			await run(
				`INSERT OR REPLACE INTO characters VALUES ${values};`,
			);
		}

		// Batch insert items
		console.log("[v2] Inserting items...");
		const allItemValues = allParsed.flatMap((p) => p.itemValues);
		for (let i = 0; i < allItemValues.length; i += BATCH_SIZE) {
			const batch = allItemValues.slice(i, i + BATCH_SIZE);
			await run(`INSERT INTO items VALUES ${batch.join(",")};`);
		}

		// Batch insert skills
		console.log("[v2] Inserting skills...");
		const allSkillValues = allParsed.flatMap((p) => p.skillValues);
		for (let i = 0; i < allSkillValues.length; i += BATCH_SIZE) {
			const batch = allSkillValues.slice(i, i + BATCH_SIZE);
			await run(`INSERT INTO skills VALUES ${batch.join(",")};`);
		}

		const elapsed = Date.now() - startTime;
		console.log(
			`\n[v2] Done in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`,
		);
		console.log(`  Characters: ${allParsed.length}`);
		console.log(`  Items: ${allItemValues.length}`);
		console.log(`  Skills: ${allSkillValues.length}`);
		console.log(`  DB: ${DB_PATH}`);

		db.close();
	}

	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
