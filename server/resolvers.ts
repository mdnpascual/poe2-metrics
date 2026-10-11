import type { DB } from "./db.js";

type Context = { db: DB };

type CharacterFilter = {
	classes?: string[];
	keystones?: string[];
	minLevel?: number;
	maxLevel?: number;
};

type ItemFilter = {
	characterFilter?: CharacterFilter;
	slots?: string[];
	rarities?: string[];
	corrupted?: boolean;
	fractured?: boolean;
	baseTypes?: string[];
	itemNames?: string[];
	reqTypes?: string[];
	anoints?: string[];
	modContains?: string;
};

type SkillFilter = {
	characterFilter?: CharacterFilter;
	skillNames?: string[];
};

function escSql(s: string): string {
	return s.replace(/'/g, "''");
}

function toNum(val: unknown): number {
	return Number(val) || 0;
}

function buildCharWhere(f?: CharacterFilter, alias = "c"): string {
	const clauses: string[] = [];
	if (f?.classes?.length) {
		const list = f.classes.map((c) => `'${escSql(c)}'`).join(",");
		clauses.push(`${alias}.class IN (${list})`);
	}
	if (f?.keystones?.length) {
		// keystones stored as JSON array, must have ALL selected keystones
		const checks = f.keystones.map(
			(k) => `list_contains(${alias}.keystones::VARCHAR[], '${escSql(k)}')`,
		);
		clauses.push(`(${checks.join(" AND ")})`);
	}
	if (f?.minLevel != null) {
		clauses.push(`${alias}.level >= ${Number(f.minLevel)}`);
	}
	if (f?.maxLevel != null) {
		clauses.push(`${alias}.level <= ${Number(f.maxLevel)}`);
	}
	return clauses.length ? clauses.join(" AND ") : "1=1";
}

function buildItemWhere(f?: ItemFilter, alias = "i"): string {
	const clauses: string[] = [];
	if (f?.slots?.length) {
		const list = f.slots.map((s) => `'${escSql(s)}'`).join(",");
		clauses.push(`${alias}.inventory_id IN (${list})`);
	}
	if (f?.rarities?.length) {
		const list = f.rarities.map((r) => `'${escSql(r)}'`).join(",");
		clauses.push(`${alias}.rarity IN (${list})`);
	}
	if (f?.corrupted != null) {
		clauses.push(`${alias}.corrupted = ${f.corrupted}`);
	}
	if (f?.fractured != null) {
		clauses.push(`${alias}.fractured = ${f.fractured}`);
	}
	if (f?.baseTypes?.length) {
		const list = f.baseTypes.map((b) => `'${escSql(b)}'`).join(",");
		clauses.push(`${alias}.base_type IN (${list})`);
	}
	if (f?.itemNames?.length) {
		const list = f.itemNames.map((n) => `'${escSql(n)}'`).join(",");
		clauses.push(`${alias}.name IN (${list})`);
	}
	if (f?.reqTypes?.length) {
		const list = f.reqTypes.map((r) => `'${escSql(r)}'`).join(",");
		clauses.push(`${alias}.req_type IN (${list})`);
	}
	if (f?.anoints?.length) {
		const checks = f.anoints.map(
			(a) => `${alias}.enchant_mods::VARCHAR ILIKE '%Allocates%${escSql(a)}%'`,
		);
		clauses.push(`(${checks.join(" OR ")})`);
	}
	if (f?.modContains) {
		clauses.push(
			`${alias}.explicit_mods::VARCHAR ILIKE '%${escSql(f.modContains)}%'`,
		);
	}
	return clauses.length ? clauses.join(" AND ") : "1=1";
}

export const resolvers = {
	Query: {
		filterOptions: async (
			_: unknown,
			args: { filter?: ItemFilter },
			ctx: Context,
		) => {
			const { db } = ctx;
			const charWhere = buildCharWhere(args.filter?.characterFilter);
			const itemWhere = buildItemWhere(args.filter);
			const charIdFilter =
				charWhere === "1=1"
					? "1=1"
					: `i.character_id IN (SELECT id FROM characters c WHERE ${charWhere})`;
			const fullWhere = `${charIdFilter} AND ${itemWhere}`;

			// Classes: count characters that have items matching item filters
			const classQuery =
				itemWhere === "1=1"
					? `SELECT class as name, COUNT(*) as count FROM characters c WHERE ${charWhere} GROUP BY class ORDER BY count DESC`
					: `SELECT c.class as name, COUNT(DISTINCT c.id) as count FROM characters c JOIN items i ON i.character_id = c.id WHERE ${charWhere} AND ${itemWhere} GROUP BY c.class ORDER BY count DESC`;
			const classes = await db.all<{ name: string; count: number }>(classQuery);
			const totalChars = classes.reduce((s, r) => s + toNum(r.count), 0);

			// Slots: count items matching char+item filters
			const slotsRaw = await db.all<{ name: string; count: number }>(`
				SELECT inventory_id as name, COUNT(*) as count
				FROM items i WHERE ${fullWhere} AND inventory_id != ''
				GROUP BY inventory_id
			`);
			// Sort: PassiveJewels first, then alphabetical
			const slots = slotsRaw.sort((a, b) => {
				if (a.name === "PassiveJewels") return -1;
				if (b.name === "PassiveJewels") return 1;
				return a.name.localeCompare(b.name);
			});

			// Rarities: count items matching char+item filters
			const rarities = await db.all<{ name: string; count: number }>(`
				SELECT rarity as name, COUNT(*) as count
				FROM items i WHERE ${fullWhere} AND rarity != ''
				GROUP BY rarity ORDER BY count DESC
			`);

			// Keystones: count characters that have items matching item filters
			const keystoneQuery =
				itemWhere === "1=1"
					? `SELECT ks.name, COUNT(*) as count FROM characters c, LATERAL unnest(c.keystones::VARCHAR[]) AS ks(name) WHERE ${charWhere} GROUP BY ks.name ORDER BY count DESC`
					: `SELECT ks.name, COUNT(DISTINCT c.id) as count FROM characters c JOIN items i ON i.character_id = c.id, LATERAL unnest(c.keystones::VARCHAR[]) AS ks(name) WHERE ${charWhere} AND ${itemWhere} GROUP BY ks.name ORDER BY count DESC`;
			const keystones = await db.all<{ name: string; count: number }>(keystoneQuery);

			const totalItems = slots.reduce((s, r) => s + toNum(r.count), 0);

			const withPct = (rows: { name: string; count: number }[], total: number) =>
				rows.map((r) => ({
					name: r.name,
					count: toNum(r.count),
					percentage: total > 0 ? Math.round((toNum(r.count) / total) * 1000) / 10 : 0,
				}));

			// Unique item names (only when Unique rarity is filtered)
			const hasUnique = args.filter?.rarities?.some(
				(r) => r.toLowerCase() === "unique",
			);
			let uniqueNames: { name: string; count: number }[] = [];
			if (hasUnique) {
				uniqueNames = await db.all<{ name: string; count: number }>(`
					SELECT name, COUNT(*) as count
					FROM items i
					WHERE ${fullWhere} AND name != '' AND rarity = 'Unique'
					GROUP BY name ORDER BY count DESC LIMIT 50
				`);
			}

			const reqTypes = await db.all<{ name: string; count: number }>(`
				SELECT req_type as name, COUNT(*) as count
				FROM items i WHERE ${fullWhere} AND req_type != ''
				GROUP BY req_type ORDER BY count DESC
			`);

			// Base types: use filters except baseTypes itself so list isn't self-filtering
			const baseTypesFilter = { ...args.filter, baseTypes: undefined };
			const btItemWhere = buildItemWhere(baseTypesFilter);
			const btCharIdFilter =
				charWhere === "1=1"
					? "1=1"
					: `i.character_id IN (SELECT id FROM characters c WHERE ${charWhere})`;
			const btFullWhere = `${btCharIdFilter} AND ${btItemWhere}`;
			const baseTypesData = await db.all<{ name: string; count: number }>(`
				SELECT base_type as name, COUNT(*) as count
				FROM items i WHERE ${btFullWhere} AND base_type != ''
				GROUP BY base_type ORDER BY count DESC LIMIT 100
			`);

			const latestRow = await db.all<{ sf: string }>(`
				SELECT source_file as sf FROM characters ORDER BY source_file DESC LIMIT 1
			`);

			// Anoints: extract from enchant_mods where starts with "Allocates"
			const anointRowsF = await db.all<{ id: string; mod: string }>(`
				SELECT id, unnest(enchant_mods::VARCHAR[]) as mod
				FROM items i WHERE ${fullWhere}
			`);
			const anointOnlyF = anointRowsF.filter((r) => String(r.mod).startsWith("Allocates "));
			const anoints = aggregateAnoints(anointOnlyF, new Set(anointOnlyF.map((r) => r.id)).size);
			// Extract timestamp folder name from path
			const latestPath = latestRow[0]?.sf ?? "";
			const match = latestPath.match(/poe\.ninja[\\/]([^\\/]+)[\\/]/);
			const latestData = match?.[1] ?? "";

			const leagueRow = await db.all<{ league: string }>(`
				SELECT league FROM characters WHERE league != '' LIMIT 1
			`);
			const league = leagueRow[0]?.league ?? "";

			return {
				classes: withPct(classes, totalChars),
				slots: withPct(slots, totalItems),
				rarities: withPct(rarities, totalItems),
				keystones: withPct(keystones, totalChars),
				baseTypes: withPct(baseTypesData, totalItems),
				uniqueNames: withPct(uniqueNames, totalItems),
				reqTypes: withPct(reqTypes, totalItems),
				anoints,
				totalCharacters: totalChars,
				totalItems,
				latestData,
				league,
			};
		},

		itemAggregations: async (
			_: unknown,
			args: { filter?: ItemFilter },
			ctx: Context,
		) => {
			const { db } = ctx;
			const charWhere = buildCharWhere(args.filter?.characterFilter);
			const itemWhere = buildItemWhere(args.filter);
			const charIdFilter =
				charWhere === "1=1"
					? "1=1"
					: `i.character_id IN (SELECT id FROM characters c WHERE ${charWhere})`;

			const fullWhere = `${charIdFilter} AND ${itemWhere}`;

			const byBaseType = await db.all<{ name: string; count: number }>(`
				SELECT base_type as name, COUNT(*) as count
				FROM items i WHERE ${fullWhere} AND base_type != ''
				GROUP BY base_type ORDER BY count DESC LIMIT 100
			`);

			const byName = await db.all<{ name: string; count: number }>(`
				SELECT name, COUNT(*) as count
				FROM items i WHERE ${fullWhere} AND name != ''
				GROUP BY name ORDER BY count DESC LIMIT 100
			`);

			const byRarity = await db.all<{ name: string; count: number }>(`
				SELECT rarity as name, COUNT(*) as count
				FROM items i WHERE ${fullWhere} AND rarity != ''
				GROUP BY rarity ORDER BY count DESC
			`);

			const byReqType = await db.all<{ name: string; count: number }>(`
				SELECT req_type as name, COUNT(*) as count
				FROM items i WHERE ${fullWhere} AND req_type != ''
				GROUP BY req_type ORDER BY count DESC
			`);

			const stats = await db.all<{
				total: number;
				avg_ilvl: number;
				corrupted_count: number;
				fractured_count: number;
			}>(`
				SELECT
					COUNT(*) as total,
					COALESCE(AVG(ilvl), 0) as avg_ilvl,
					SUM(CASE WHEN corrupted THEN 1 ELSE 0 END) as corrupted_count,
					SUM(CASE WHEN fractured THEN 1 ELSE 0 END) as fractured_count
				FROM items i WHERE ${fullWhere}
			`);

			const s = stats[0] ?? { total: 0, avg_ilvl: 0, corrupted_count: 0, fractured_count: 0 };
			const totalCount = toNum(s.total);

			const withPct = (rows: { name: string; count: number }[]) =>
				rows.map((r) => ({
					name: r.name,
					count: toNum(r.count),
					percentage: totalCount > 0 ? Math.round((toNum(r.count) / totalCount) * 1000) / 10 : 0,
				}));

			// Mod frequency: unnest mod arrays, normalize numbers to #
			// Merge all affix sources, deduplicate per item per normalized mod in JS
			const explicitModRows = await db.all<{ id: string; mod: string }>(`
				SELECT id, unnest(explicit_mods::VARCHAR[]) as mod FROM items i WHERE ${fullWhere}
				UNION ALL
				SELECT id, unnest(fractured_mods::VARCHAR[]) as mod FROM items i WHERE ${fullWhere}
				UNION ALL
				SELECT id, unnest(crafted_mods::VARCHAR[]) as mod FROM items i WHERE ${fullWhere}
				UNION ALL
				SELECT id, unnest(desecrated_mods::VARCHAR[]) as mod FROM items i WHERE ${fullWhere}
				UNION ALL
				SELECT id, unnest(enchant_mods::VARCHAR[]) as mod FROM items i WHERE ${fullWhere}
			`);

			const implicitModRows = await db.all<{ id: string; mod: string }>(`
				SELECT id, unnest(implicit_mods::VARCHAR[]) as mod
				FROM items i WHERE ${fullWhere}
			`);

			const runeModRows = await db.all<{ id: string; mod: string }>(`
				SELECT id, unnest(rune_mods::VARCHAR[]) as mod
				FROM items i WHERE ${fullWhere}
			`);

			const byExplicitMod = aggregateMods(explicitModRows, new Set(explicitModRows.map((r) => r.id)).size);
			const byImplicitMod = aggregateMods(implicitModRows, new Set(implicitModRows.map((r) => r.id)).size);
			const byRuneMod = aggregateMods(runeModRows, new Set(runeModRows.map((r) => r.id)).size);

			// Anoints
			const anointRows = await db.all<{ id: string; mod: string }>(`
				SELECT id, unnest(enchant_mods::VARCHAR[]) as mod
				FROM items i WHERE ${fullWhere}
			`);
			const anointOnlyRows = anointRows.filter((r) => String(r.mod).startsWith("Allocates "));
			const byAnoint = aggregateAnoints(anointOnlyRows, new Set(anointOnlyRows.map((r) => r.id)).size);

			return {
				totalCount,
				byBaseType: withPct(byBaseType),
				byName: withPct(byName),
				byRarity: withPct(byRarity),
				byReqType: withPct(byReqType),
				byExplicitMod,
				byImplicitMod,
				byRuneMod,
				byAnoint,
				avgIlvl: Math.round(toNum(s.avg_ilvl) * 10) / 10,
				corruptedCount: toNum(s.corrupted_count),
				fracturedCount: toNum(s.fractured_count),
			};
		},

		itemMods: async (
			_: unknown,
			args: { filter?: ItemFilter; limit?: number },
			ctx: Context,
		) => {
			const { db } = ctx;
			const charWhere = buildCharWhere(args.filter?.characterFilter);
			const itemWhere = buildItemWhere(args.filter);
			const charIdFilter =
				charWhere === "1=1"
					? "1=1"
					: `i.character_id IN (SELECT id FROM characters c WHERE ${charWhere})`;
			const limit = Math.min(args.limit ?? 1000000, 1000000);

			const rows = await db.all<any>(`
				SELECT explicit_mods, fractured_mods, crafted_mods,
					desecrated_mods, enchant_mods, implicit_mods, rune_mods
				FROM items i
				WHERE ${charIdFilter} AND ${itemWhere}
				LIMIT ${limit}
			`);

			return rows.map((r: any) => ({
				explicitMods: parseJsonArray(r.explicit_mods),
				fracturedMods: parseJsonArray(r.fractured_mods),
				craftedMods: parseJsonArray(r.crafted_mods),
				desecratedMods: parseJsonArray(r.desecrated_mods),
				enchantMods: parseJsonArray(r.enchant_mods),
				implicitMods: parseJsonArray(r.implicit_mods),
				runeMods: parseJsonArray(r.rune_mods),
			}));
		},

		skillAggregations: async (
			_: unknown,
			args: { filter?: SkillFilter },
			ctx: Context,
		) => {
			const { db } = ctx;
			const charWhere = buildCharWhere(args.filter?.characterFilter);
			const charIdFilter =
				charWhere === "1=1"
					? "1=1"
					: `s.character_id IN (SELECT id FROM characters c WHERE ${charWhere})`;

			const bySkillName = await db.all<{ name: string; count: number }>(`
				SELECT skill_name as name, COUNT(*) as count
				FROM skills s WHERE ${charIdFilter} AND skill_name != ''
				GROUP BY skill_name ORDER BY count DESC LIMIT 30
			`);

			const totalCount = bySkillName.reduce((s, r) => s + toNum(r.count), 0);

			const avgDpsRow = await db.all<{ avg_dps: number }>(`
				SELECT COALESCE(AVG(dps), 0) as avg_dps
				FROM skills s WHERE ${charIdFilter} AND dps > 0
			`);

			return {
				totalCount,
				bySkillName: bySkillName.map((r) => ({
					name: r.name,
					count: toNum(r.count),
					percentage: totalCount > 0 ? Math.round((toNum(r.count) / totalCount) * 1000) / 10 : 0,
				})),
				bySupportGem: [],
				avgDps: Math.round((avgDpsRow[0]?.avg_dps ?? 0) * 10) / 10,
				dpsDistribution: [],
			};
		},

		defenseDistribution: async (
			_: unknown,
			args: { filter?: CharacterFilter },
			ctx: Context,
		) => {
			const { db } = ctx;
			const charWhere = buildCharWhere(args.filter);

			const avgs = await db.all<{ avg_life: number; avg_es: number }>(`
				SELECT
					COALESCE(AVG(life), 0) as avg_life,
					COALESCE(AVG(energy_shield), 0) as avg_es
				FROM characters c WHERE ${charWhere}
			`);

			return {
				lifeHistogram: [],
				esHistogram: [],
				armourHistogram: [],
				evasionHistogram: [],
				avgLife: Math.round((avgs[0]?.avg_life ?? 0) * 10) / 10,
				avgEs: Math.round((avgs[0]?.avg_es ?? 0) * 10) / 10,
			};
		},
	},
};

function normalizeMod(mod: string): string {
	if (!mod) return "";
	// Replace numeric values with #, preserving leading +/- and trailing %
	return mod.replace(
		/([+-]?)(\d+(?:\.\d+)?)(%?)/g,
		(_m, sign: string, _num: string, pct: string) => `${sign}#${pct}`,
	);
}

function aggregateMods(
	rows: { id?: string; mod: string }[],
	totalItems: number,
): { name: string; count: number; percentage: number }[] {
	const counts = new Map<string, number>();
	// Track which items already counted for each normalized mod
	const seen = new Map<string, Set<string>>();

	for (const row of rows) {
		const normalized = normalizeMod(String(row.mod ?? ""));
		if (!normalized) continue;

		const itemId = String(row.id ?? "");
		if (itemId) {
			let itemSet = seen.get(normalized);
			if (!itemSet) {
				itemSet = new Set();
				seen.set(normalized, itemSet);
			}
			if (itemSet.has(itemId)) continue; // already counted this mod for this item
			itemSet.add(itemId);
		}

		counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
	}

	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 100)
		.map(([name, count]) => ({
			name,
			count,
			percentage:
				totalItems > 0
					? Math.round((count / totalItems) * 1000) / 10
					: 0,
		}));
}

function extractAnointName(mod: string): string | null {
	if (!mod.startsWith("Allocates ")) return null;
	// Format: "Allocates [tag|Display Name]"
	const pipeMatch = mod.match(/\|([^\]]+)\]/);
	if (pipeMatch) return pipeMatch[1];
	// Fallback: "Allocates [Name]"
	const bracketMatch = mod.match(/\[([^\]]+)\]/);
	if (bracketMatch) return bracketMatch[1];
	// Fallback: strip "Allocates "
	return mod.slice(10);
}

function aggregateAnoints(
	rows: { id?: string; mod: string }[],
	totalItems: number,
): { name: string; count: number; percentage: number }[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		const name = extractAnointName(String(row.mod ?? ""));
		if (!name) continue;
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 100)
		.map(([name, count]) => ({
			name,
			count,
			percentage: totalItems > 0 ? Math.round((count / totalItems) * 1000) / 10 : 0,
		}));
}

function parseJsonArray(val: unknown): string[] {
	if (Array.isArray(val)) return val;
	if (typeof val === "string") {
		try {
			const parsed = JSON.parse(val);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
}
