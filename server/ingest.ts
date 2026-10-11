/**
 * Ingests all scraped JSON captures into DuckDB.
 *
 * Usage: npm run ingest [-- <path-to-poe.ninja-folder>]
 * Default: ../scraper/data/poe.ninja/
 */
import fs from "fs-extra";
import path from "node:path";
import crypto from "node:crypto";
import { initDb, type DB } from "./db.js";

const DEFAULT_DATA_ROOT = path.resolve("..", "scraper", "data", "poe.ninja");

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

async function findAllJsonFiles(dataRoot: string): Promise<string[]> {
	const result: string[] = [];
	const folders = await fs.readdir(dataRoot, { withFileTypes: true });

	for (const folder of folders) {
		if (!folder.isDirectory()) continue;
		const capturesDir = path.join(dataRoot, folder.name, "captures");
		if (!(await fs.pathExists(capturesDir))) continue;

		const files = await fs.readdir(capturesDir);
		for (const f of files) {
			if (f.endsWith(".json")) {
				result.push(path.join(capturesDir, f));
			}
		}
	}

	return result;
}

async function ingest(db: DB, files: string[]): Promise<void> {
	// Clear existing data for clean re-ingestion
	await db.run("DELETE FROM flasks;");
	await db.run("DELETE FROM skills;");
	await db.run("DELETE FROM items;");
	await db.run("DELETE FROM characters;");

	let charCount = 0;
	let itemCount = 0;
	let skipCount = 0;

	for (const filePath of files) {
		let data: any;
		try {
			data = await fs.readJson(filePath);
		} catch {
			skipCount++;
			continue;
		}

		// Skip if not a character profile
		if (!data.class || !Array.isArray(data.items)) {
			skipCount++;
			continue;
		}

		const charId = sha1(`${data.account ?? ""}/${data.name ?? ""}`);
		const ds = data.defensiveStats ?? {};

		const charSql = `INSERT OR REPLACE INTO characters VALUES (
			'${escSql(charId)}',
			'${escSql(String(data.account ?? ""))}',
			'${escSql(String(data.name ?? ""))}',
			'${escSql(String(data.league ?? ""))}',
			'${escSql(String(data.class ?? ""))}',
			${toInt(data.baseClass)},
			${toInt(data.level)},
			${toInt(ds.life)},
			${toInt(ds.energyShield)},
			${toInt(ds.mana)},
			${toInt(ds.spirit)},
			${toInt(ds.evasionRating)},
			${toInt(ds.armour)},
			${toInt(ds.fireResistance)},
			${toInt(ds.coldResistance)},
			${toInt(ds.lightningResistance)},
			${toInt(ds.chaosResistance)},
			${toInt(ds.effectiveHealthPool)},
			${toJsonLiteral((data.keystones ?? []).map((k: any) => k.name ?? ""))},
			'${escSql(filePath)}'
		);`;

		await db.run(charSql);
		charCount++;

		// Items + Jewels + Flasks (same structure)
		const allItems = [
			...(data.items ?? []),
			...(data.jewels ?? []),
			...(data.flasks ?? []),
		];
		for (const item of allItems) {
			const d = item?.itemData;
			if (!d) continue;

			const itemId = d.id ?? sha1(JSON.stringify(d).slice(0, 200));
			itemCount++;

			const itemSql = `INSERT INTO items VALUES (
				'${escSql(itemId)}',
				'${escSql(charId)}',
				${toInt(item.itemSlot)},
				'${escSql(String(d.inventoryId ?? ""))}',
				'${escSql(String(d.name ?? ""))}',
				'${escSql(String(d.baseType ?? ""))}',
				'${escSql(String(d.typeLine ?? ""))}',
				'${escSql(String(d.rarity ?? d.frameTypeId ?? ""))}',
				${toInt(d.ilvl)},
				${toBool(d.corrupted)},
				${toBool(d.fractured)},
				${toBool(d.desecrated)},
				${toInt(d.qualityProperty)},
				'${escSql(computeReqType(d.requirements))}',
				${toJsonLiteral(d.explicitMods ?? [])},
				${toJsonLiteral(d.fracturedMods ?? [])},
				${toJsonLiteral(d.craftedMods ?? [])},
				${toJsonLiteral(d.enchantMods ?? [])},
				${toJsonLiteral(d.desecratedMods ?? [])},
				${toJsonLiteral(d.runeMods ?? [])},
				${toJsonLiteral(d.implicitMods ?? [])},
				${toJsonLiteral(d.mods ?? null)},
				${toJsonLiteral(d.sockets ?? [])},
				${toJsonLiteral(d.requirements ?? [])},
				${toJsonLiteral(d.properties ?? [])}
			);`;

			await db.run(itemSql);
		}

		// Skills
		for (const skill of data.skills ?? []) {
			const allGems = skill.allGems ?? [];
			const mainGem = allGems[0];
			if (!mainGem) continue;

			const supports = allGems
				.slice(1)
				.filter((g: any) => g.itemData?.support)
				.map((g: any) => g.name ?? "");

			const dps = skill.dps?.[0]?.dps ?? 0;

			const skillSql = `INSERT INTO skills VALUES (
				'${escSql(charId)}',
				'${escSql(String(mainGem.name ?? ""))}',
				${toJsonLiteral(supports)},
				${Number(dps) || 0},
				${toInt(mainGem.level)},
				${toInt(mainGem.quality)}
			);`;

			await db.run(skillSql);
		}

		// Flasks
		for (const flask of data.flasks ?? []) {
			const d = flask?.itemData;
			if (!d) continue;

			const flaskSql = `INSERT INTO flasks VALUES (
				'${escSql(charId)}',
				'${escSql(String(d.baseType ?? ""))}',
				'${escSql(String(d.rarity ?? d.frameTypeId ?? ""))}',
				${toJsonLiteral(d.explicitMods ?? [])}
			);`;

			await db.run(flaskSql);
		}

		if (charCount % 50 === 0) {
			process.stdout.write(`\r  Ingested ${charCount} characters...`);
		}
	}

	console.log(
		`\nIngested ${charCount} characters, ${itemCount} items (skipped ${skipCount} non-profile files)`,
	);
}

async function main() {
	const dataRoot = process.argv[2] || DEFAULT_DATA_ROOT;
	console.log(`Scanning: ${dataRoot}`);

	const files = await findAllJsonFiles(dataRoot);
	console.log(`Found ${files.length} JSON files`);

	if (!files.length) {
		console.error("No JSON files found. Check the data path.");
		process.exit(1);
	}

	const db = await initDb();
	await ingest(db, files);

	// Print summary
	const chars = await db.all<{ cnt: number }>(
		"SELECT COUNT(*) as cnt FROM characters",
	);
	const items = await db.all<{ cnt: number }>(
		"SELECT COUNT(*) as cnt FROM items",
	);
	const skills = await db.all<{ cnt: number }>(
		"SELECT COUNT(*) as cnt FROM skills",
	);

	console.log(`\nDB Summary:`);
	console.log(`  Characters: ${chars[0]?.cnt}`);
	console.log(`  Items: ${items[0]?.cnt}`);
	console.log(`  Skills: ${skills[0]?.cnt}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
