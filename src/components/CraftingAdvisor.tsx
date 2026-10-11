import { useState, useMemo, useEffect } from "react";
import { useQuery } from "urql";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import { ITEM_MODS_QUERY } from "../graphql/queries";
import type { Filters } from "../App";

type ItemModSet = {
	explicitMods: string[];
	fracturedMods: string[];
	craftedMods: string[];
	desecratedMods: string[];
	enchantMods: string[];
	implicitMods: string[];
	runeMods: string[];
};

function normalizeMod(mod: string): string {
	if (!mod) return "";
	return mod
		.replace(/[\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(
			/([+-]?)(\d+(?:\.\d+)?)(%?)/g,
			(_m, sign: string, _num: string, pct: string) => `${sign}#${pct}`,
		);
}

function getAllMods(item: ItemModSet): string[] {
	return [
		...item.explicitMods,
		...item.fracturedMods,
		...item.craftedMods,
		...item.desecratedMods,
		...item.enchantMods,
	];
}

function getNormalizedModSet(item: ItemModSet): Set<string> {
	return new Set(getAllMods(item).map(normalizeMod).filter(Boolean));
}

// Strip [tag|name] → name, and remove leading +/- for matching trade API text
function modToTradeText(mod: string): string {
	return mod
		.replace(/\[([^\]|]*\|)?([^\]]*)\]/g, "$2") // [tag|name] → name
		.replace(/^\+/, ""); // strip leading +
}

type StatMap = Map<string, string>; // text → id

// In production, CloudFront proxies /api/trade2/* to pathofexile.com.
// In dev, Vite proxy handles it.
const TRADE_STATS_URL = "/api/trade2/data/stats";

// Cache the trade stats fetch at module level so it's only called once per session
let tradeStatsPromise: Promise<{ explicit: StatMap; pseudo: StatMap }> | null = null;
function fetchTradeStats(): Promise<{ explicit: StatMap; pseudo: StatMap }> {
	if (!tradeStatsPromise) {
		tradeStatsPromise = fetch(TRADE_STATS_URL)
			.then((r) => r.json())
			.then((data) => {
				const explicit: StatMap = new Map();
				const pseudo: StatMap = new Map();
				for (const group of data.result ?? []) {
					if (group.id === "explicit") {
						for (const entry of group.entries ?? []) {
							if (!explicit.has(entry.text)) {
								explicit.set(entry.text, entry.id);
							}
						}
					} else if (group.id === "pseudo") {
						for (const entry of group.entries ?? []) {
							if (!pseudo.has(entry.text)) {
								pseudo.set(entry.text, entry.id);
							}
						}
					}
				}
				return { explicit, pseudo };
			})
			.catch(() => ({ explicit: new Map(), pseudo: new Map() }));
	}
	return tradeStatsPromise;
}

const SLOT_TO_CATEGORY: Record<string, string> = {
	Helm: "armour.helmet",
	BodyArmour: "armour.chest",
	Gloves: "armour.gloves",
	Boots: "armour.boots",
	Weapon: "weapon",
	Weapon2: "weapon",
	Offhand: "armour.shield",
	Offhand2: "armour.shield",
	Ring: "accessory.ring",
	Ring2: "accessory.ring",
	Amulet: "accessory.amulet",
	Belt: "accessory.belt",
	PassiveJewels: "jewel",
	Flask: "flask",
};

function buildTradeUrl(
	selectedMods: string[],
	selectedBaseTypes: string[],
	league: string,
	statMap: StatMap,
	pseudoMap: StatMap,
	slots: string[],
	reqTypes: string[],
): string {
	const query: any = { query: { stats: [] } };

	// Rarity logic: always 2 mods = magic, 3+ = rare for trade search
	const rarity = selectedMods.length === 2 ? "magic" : "rare";
	query.query.status = { option: "securable" };
	query.query.filters = {
		type_filters: { filters: { rarity: { option: rarity }, ilvl: { min: 78 } } },
	};

	// Item category from slot filter
	if (slots.length === 1 && SLOT_TO_CATEGORY[slots[0]]) {
		query.query.filters.type_filters.filters.category = { option: SLOT_TO_CATEGORY[slots[0]] };
	}

	// Requirement filters (e.g. "dex_int" → dex: {min:1}, int: {min:1})
	if (reqTypes.length === 1) {
		const reqs: Record<string, { min: number }> = {};
		for (const part of reqTypes[0].split("_")) {
			reqs[part] = { min: 1 };
		}
		query.query.filters.req_filters = { filters: reqs };
	}

	// Trade filters: indexed within 3 days
	query.query.filters.trade_filters = { filters: { indexed: { option: "3days" } } };

	// Sort by price descending
	query.sort = { price: "desc" };

	// Base type: only if exactly 1 selected
	if (selectedBaseTypes.length === 1) {
		query.query.type = selectedBaseTypes[0];
	}

	// Stats: resolve mod text to trade stat IDs (pseudo > local > explicit)
	// Special handling: resistance mods aggregate into pseudo totals
	const ELE_RE = /\b(fire|cold|lightning)\b/i;
	const CHAOS_RE = /\bchaos\b/i;
	const RESIST_RE = /resistance/i;

	let eleMin = 0;
	let chaosMin = 0;
	const normalFilters: { id: string; disabled: boolean; value?: { min: number } }[] = [];

	for (const mod of selectedMods) {
		const tradeText = modToTradeText(mod);
		const isResist = RESIST_RE.test(tradeText);

		if (isResist) {
			const hasEle = ELE_RE.test(tradeText);
			const hasChaos = CHAOS_RE.test(tradeText);
			// Count how many ele resistances in this mod (e.g. "Fire and Cold" = 2)
			const eleCount = (tradeText.match(/\b(fire|cold|lightning)\b/gi) ?? []).length;
			const isCombination = (hasEle && hasChaos) || eleCount > 1;

			if (isCombination) {
				if (hasEle) eleMin += 13 * eleCount;
				if (hasChaos) chaosMin += 13;
			} else {
				if (hasEle) eleMin += 25;
				if (hasChaos) chaosMin += 13;
			}
		} else {
			const id = pseudoMap.get(tradeText)
				?? statMap.get(`${tradeText} (Local)`)
				?? statMap.get(tradeText)
				?? statMap.get(mod)
				?? mod;
			normalFilters.push({ id, disabled: false });
		}
	}

	if (eleMin > 0) {
		const eleId = pseudoMap.get("+#% total Elemental Resistance") ?? "pseudo.pseudo_total_elemental_resistance";
		normalFilters.push({ id: eleId, disabled: false, value: { min: eleMin } });
	}
	if (chaosMin > 0) {
		const chaosId = pseudoMap.get("+#% total to Chaos Resistance") ?? "pseudo.pseudo_total_chaos_resistance";
		normalFilters.push({ id: chaosId, disabled: false, value: { min: chaosMin } });
	}

	query.query.stats = [{ type: "and", filters: normalFilters }];

	const leagueSlug = encodeURIComponent(league);
	return `https://www.pathofexile.com/trade2/search/poe2/${leagueSlug}?q=${encodeURIComponent(JSON.stringify(query))}`;
}

type Props = {
	filters: Filters;
	baseTypeOptions: { name: string; count: number }[];
	league: string;
};

export function CraftingAdvisor({ filters, baseTypeOptions, league }: Props) {
	const [selectedBaseTypes, setSelectedBaseTypes] = useState<string[]>([]);
	const [selectedMods, setSelectedMods] = useState<string[]>([]);
	const [modSearch, setModSearch] = useState("");
	const [btSearch, setBtSearch] = useState("");
	const [statMap, setStatMap] = useState<StatMap>(new Map());
	const [pseudoMap, setPseudoMap] = useState<StatMap>(new Map());

	useEffect(() => {
		fetchTradeStats().then(({ explicit, pseudo }) => {
			setStatMap(explicit);
			setPseudoMap(pseudo);
		});
	}, []);

	const charFilter =
		filters.classes.length || filters.keystones.length
			? {
					classes: filters.classes.length ? filters.classes : undefined,
					keystones: filters.keystones.length
						? filters.keystones
						: undefined,
				}
			: undefined;

	const itemFilter = selectedBaseTypes.length
		? {
				characterFilter: charFilter,
				baseTypes: selectedBaseTypes,
				slots: filters.slots.length ? filters.slots : undefined,
			}
		: null;

	const [result] = useQuery({
		query: ITEM_MODS_QUERY,
		variables: { filter: itemFilter, limit: 1000000 },
		pause: !itemFilter,
	});

	const items: ItemModSet[] = result.data?.itemMods ?? [];

	// Get all available normalized mods for the selected base type
	const availableMods = useMemo(() => {
		const counts = new Map<string, number>();
		for (const item of items) {
			const modSet = getNormalizedModSet(item);
			for (const mod of modSet) {
				counts.set(mod, (counts.get(mod) ?? 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	}, [items]);

	// Filter items that have ALL selected mods
	const matchingItems = useMemo(() => {
		if (!selectedMods.length) return items;
		return items.filter((item) => {
			const modSet = getNormalizedModSet(item);
			return selectedMods.every((m) => modSet.has(m));
		});
	}, [items, selectedMods]);

	// Compute co-occurring mods from matching items
	const coOccurring = useMemo(() => {
		const counts = new Map<string, number>();
		const selectedSet = new Set(selectedMods);
		for (const item of matchingItems) {
			const modSet = getNormalizedModSet(item);
			for (const mod of modSet) {
				if (selectedSet.has(mod)) continue;
				counts.set(mod, (counts.get(mod) ?? 0) + 1);
			}
		}
		const total = matchingItems.length;
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({
				name,
				count,
				percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
			}));
	}, [matchingItems, selectedMods]);

	// Filter available mods by search
	const filteredAvailable = modSearch
		? availableMods.filter((m) =>
				m.name.toLowerCase().includes(modSearch.toLowerCase()),
			)
		: availableMods.slice(0, 30);

	return (
		<div className="space-y-6">
			<h2 className="text-lg font-bold">Crafting Advisor</h2>
			<p className="text-sm text-gray-400">
				Select a base type and affixes to see what other mods top players pair with them.
			</p>

			{/* Base Type selector */}
			<div>
				<label className="text-xs text-gray-500 block mb-1">
					Base Types ({selectedBaseTypes.length} selected)
				</label>
				<div className="flex gap-2 mb-2">
					<button
						onClick={() => {
							setSelectedBaseTypes(["Sapphire", "Diamond", "Emerald", "Ruby"]);
							setSelectedMods([]);
						}}
						className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-400 hover:text-white"
					>
						Jewels
					</button>
					<button
						onClick={() => {
							setSelectedBaseTypes(["Time-Lost Sapphire", "Time-Lost Diamond", "Time-Lost Emerald", "Time-Lost Ruby"]);
							setSelectedMods([]);
						}}
						className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-400 hover:text-white"
					>
						Time-Lost Jewels
					</button>
				</div>
				<div className="flex flex-wrap gap-2 mb-2">
					{selectedBaseTypes.map((bt) => (
						<span
							key={bt}
							className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs flex items-center gap-1"
						>
							{bt}
							<button
								onClick={() =>
									setSelectedBaseTypes((prev) =>
										prev.filter((b) => b !== bt),
									)
								}
								className="text-gray-400 hover:text-white"
							>
								×
							</button>
						</span>
					))}
				</div>
				<div className="flex gap-2 items-center mb-1">
					<input
						type="text"
						value={btSearch}
						onChange={(e) => setBtSearch(e.target.value)}
						placeholder="Search base types..."
						className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 flex-1 max-w-md"
					/>
					<button
						onClick={() => {
							const toAdd = baseTypeOptions
								.filter(
									(bt) =>
										!selectedBaseTypes.includes(bt.name) &&
										(!btSearch || bt.name.toLowerCase().includes(btSearch.toLowerCase())),
								)
								.map((bt) => bt.name);
							setSelectedBaseTypes((prev) => [...prev, ...toAdd]);
							setSelectedMods([]);
						}}
						className="text-xs text-gray-500 hover:text-white shrink-0"
					>
						+All
					</button>
				</div>
				<div className="max-h-36 overflow-y-auto space-y-0.5">
					{baseTypeOptions
						.filter(
							(bt) =>
								!selectedBaseTypes.includes(bt.name) &&
								(!btSearch ||
									bt.name
										.toLowerCase()
										.includes(btSearch.toLowerCase())),
						)
						.slice(0, 20)
						.map((bt) => (
							<button
								key={bt.name}
								onClick={() => {
									setSelectedBaseTypes((prev) => [
										...prev,
										bt.name,
									]);
									setSelectedMods([]);
								}}
								className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-800 rounded text-gray-300"
							>
								{bt.name}
								<span className="text-gray-600 ml-2">
									({bt.count})
								</span>
							</button>
						))}
				</div>
			</div>

			{selectedBaseTypes.length > 0 && (
				<>
					{/* Selected mods */}
					<div>
						<label className="text-xs text-gray-500 block mb-1">
							Selected Affixes ({selectedMods.length})
						</label>
						<div className="flex flex-wrap gap-2 mb-2">
							{selectedMods.map((mod) => (
								<span
									key={mod}
									className="bg-indigo-900/50 border border-indigo-700 rounded px-2 py-0.5 text-xs flex items-center gap-1"
								>
									{mod}
									<button
										onClick={() =>
											setSelectedMods((prev) =>
												prev.filter((m) => m !== mod),
											)
										}
										className="text-gray-400 hover:text-white"
									>
										×
									</button>
								</span>
							))}
						</div>

						{/* Open in Trade button */}
						<div className="mb-3">
							<a
								href={selectedMods.length >= 2 ? buildTradeUrl(selectedMods, selectedBaseTypes, league, statMap, pseudoMap, filters.slots, filters.reqTypes) : undefined}
								target="_blank"
								rel="noopener noreferrer"
								className={`inline-block px-3 py-1.5 text-sm rounded border ${
									selectedMods.length >= 2
										? "bg-indigo-700 border-indigo-600 text-white hover:bg-indigo-600 cursor-pointer"
										: "bg-gray-800 border-gray-700 text-gray-500 pointer-events-none"
								}`}
							>
								🔗 Open in Trade
							</a>
							{selectedMods.length >= 2 && (
								<span className="ml-2 text-xs text-gray-500">
									{selectedMods.length === 2
										? "Magic (2 mods)"
										: "Rare (3+ mods)"}
								</span>
							)}
						</div>

						{/* Mod picker */}
						<input
							type="text"
							value={modSearch}
							onChange={(e) => setModSearch(e.target.value)}
							placeholder="Search mods to add..."
							className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 w-full max-w-md mb-2"
						/>
						<div className="max-h-48 overflow-y-auto space-y-0.5">
							{filteredAvailable
								.filter((m) => !selectedMods.includes(m.name))
								.slice(0, 20)
								.map((m) => (
									<button
										key={m.name}
										onClick={() =>
											setSelectedMods((prev) => [
												...prev,
												m.name,
											])
										}
										className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-800 rounded text-gray-300"
									>
										{m.name}
										<span className="text-gray-600 ml-2">
											({m.count})
										</span>
									</button>
								))}
						</div>
					</div>

					{/* Results */}
					{items.length > 0 && (
						<div className="border-t border-gray-800 pt-6">
							<div className="text-sm text-gray-400 mb-4">
								Matching items:{" "}
								<strong className="text-white">
									{matchingItems.length}
								</strong>{" "}
								of {items.length}
							</div>

							{coOccurring.length > 0 ? (
								<>
									<h3 className="text-sm font-semibold text-gray-300 mb-2">
										{selectedMods.length > 0 ? "Most likely paired affixes" : "Most common affixes"}
									</h3>
									<ResponsiveContainer
										width="100%"
										height={coOccurring.length * 40}
									>
										<BarChart
											data={coOccurring}
											layout="vertical"
											margin={{ left: 0, right: 20 }}
										>
											<XAxis
												type="number"
												stroke="#e5e7eb"
												tick={{ fontSize: 13, fill: "#e5e7eb" }}
												unit="%"
											/>
											<YAxis
												type="category"
												dataKey="name"
												stroke="#e5e7eb"
												width={400}
												tick={{ fontSize: 12, fill: "#e5e7eb" }}
											/>
											<Tooltip
												contentStyle={{
													background: "#1f2937",
													border: "1px solid #374151",
													color: "#e5e7eb",
													fontSize: 14,
												}}
												separator=""
												formatter={(
													_v: number,
													_n: string,
													props: any,
												) => [
													`${props.payload.count} items (${props.payload.percentage}%)`,
													"",
												]}
											/>
											<Bar
												dataKey="percentage"
												fill="#6366f1"
												cursor="pointer"
												onClick={(data: any) => {
													if (data?.name && !selectedMods.includes(data.name)) {
														setSelectedMods((prev) => [...prev, data.name]);
													}
												}}
											/>
										</BarChart>
									</ResponsiveContainer>
								</>
							) : (
								<p className="text-gray-500 text-sm">
									No co-occurring mods found
								</p>
							)}
						</div>
					)}
				</>
			)}

			{!selectedBaseTypes.length && (
				<p className="text-gray-600 text-sm">
					Pick one or more base types to get started.
				</p>
			)}
		</div>
	);
}
