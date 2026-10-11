import { useState, useMemo } from "react";
import { useQuery } from "urql";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
} from "recharts";
import { ITEM_AGGREGATIONS_QUERY } from "../graphql/queries";
import type { Filters } from "../App";

const COLORS = [
	"#6366f1",
	"#f59e0b",
	"#10b981",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f97316",
];

const REQ_COLORS: Record<string, string> = {
	str: "#ef4444",
	dex: "#22c55e",
	int: "#3b82f6",
	str_dex: "#eab308",
	str_int: "#a855f7",
	dex_int: "#06b6d4",
	str_dex_int: "#ffffff",
};

type CountEntry = { name: string; count: number; percentage: number };
type SortKey = "name" | "count" | "percentage";
type SortDir = "asc" | "desc";

type Props = {
	filters: Filters;
	onToggle: (group: keyof Filters, value: string) => void;
	classData: CountEntry[];
};

function wrapText(text: string, maxChars: number): string[] {
	const clean = text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
	if (clean.length <= maxChars) return [clean];
	const words = clean.split(" ");
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		if (current && (current + " " + word).length > maxChars) {
			lines.push(current);
			current = word;
		} else {
			current = current ? current + " " + word : word;
		}
	}
	if (current) lines.push(current);
	return lines;
}

function WrappedTick({ x, y, payload, maxChars }: any) {
	const lines = wrapText(String(payload?.value ?? ""), maxChars);
	return (
		<g transform={`translate(${x},${y})`}>
			{lines.map((line, i) => (
				<text
					key={i}
					x={-5}
					y={0}
					dy={i * 18 - ((lines.length - 1) * 9)}
					textAnchor="end"
					fill="#e5e7eb"
					fontSize={14}
				>
					{line}
				</text>
			))}
		</g>
	);
}

function Collapsible({
	title,
	children,
	defaultOpen = true,
	id,
}: {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
	id?: string;
}) {
	const storageKey = id ? `collapse_${id}` : null;
	const [open, setOpen] = useState(() => {
		if (storageKey) {
			const stored = localStorage.getItem(storageKey);
			if (stored !== null) return stored === "1";
		}
		return defaultOpen;
	});

	const toggle = () => {
		const next = !open;
		setOpen(next);
		if (storageKey) localStorage.setItem(storageKey, next ? "1" : "0");
	};

	return (
		<div>
			<button
				onClick={toggle}
				className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white mb-2"
			>
				<span className="text-gray-600">{open ? "▼" : "▶"}</span>
				{title}
			</button>
			{open && children}
		</div>
	);
}

function ModChart({
	title,
	data,
	color,
	onBarClick,
}: {
	title: string;
	data: CountEntry[];
	color: string;
	onBarClick?: (entry: CountEntry) => void;
}) {
	const [fullscreen, setFullscreen] = useState(false);

	if (!data.length) return null;
	const displayed = fullscreen ? data : data.slice(0, 15);
	const ROW_HEIGHT = 50;
	const height = Math.max(200, displayed.length * ROW_HEIGHT);

	const chart = (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart
				data={displayed}
				layout="vertical"
				margin={{ left: 0, right: 20 }}
			>
				<XAxis
					type="number"
					stroke="#e5e7eb"
					fontSize={13}
					tick={{ fill: "#e5e7eb" }}
					unit="%"
				/>
				<YAxis
					type="category"
					dataKey="name"
					stroke="#e5e7eb"
					width={450}
					tick={<WrappedTick maxChars={60} />}
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
						_value: number,
						_name: string,
						props: any,
					) => [
						`${props.payload.count} items (${props.payload.percentage}%)`,
						"",
					]}
				/>
				<Bar
					dataKey="percentage"
					fill={color}
					cursor={onBarClick ? "pointer" : undefined}
					onClick={onBarClick ? (entry: any) => onBarClick(entry) : undefined}
				/>
			</BarChart>
		</ResponsiveContainer>
	);

	if (fullscreen) {
		return (
			<div
				className="fixed inset-0 z-50 bg-gray-950/95 overflow-y-auto p-8"
				onKeyDown={(e) => {
					if (e.key === "Escape") setFullscreen(false);
				}}
				tabIndex={0}
				ref={(el) => el?.focus()}
			>
				<div className="sticky top-0 z-10 flex justify-between items-center mb-4 bg-gray-950/95 py-2">
					<h2 className="text-lg font-semibold text-gray-200">
						{title} (Top {data.length})
					</h2>
					<button
						onClick={() => setFullscreen(false)}
						className="text-gray-400 hover:text-white text-2xl px-3"
					>
						✕
					</button>
				</div>
				{chart}
			</div>
		);
	}

	return (
		<Collapsible title={title} id={`mod_${title}`}>
			<div>
				<div className="flex justify-end mb-2">
					{data.length > 15 && (
						<button
							onClick={() => setFullscreen(true)}
							className="text-xs text-gray-500 hover:text-white"
							title="View all"
						>
							⛶ Top {data.length}
						</button>
					)}
				</div>
				{chart}
			</div>
		</Collapsible>
	);
}

export function ItemsTab({ filters, onToggle, classData }: Props) {
	const [sortKey, setSortKey] = useState<SortKey>("count");
	const [sortDir, setSortDir] = useState<SortDir>("desc");
	const [baseTypeFullscreen, setBaseTypeFullscreen] = useState(false);

	const charFilter =
		filters.classes.length || filters.keystones.length
			? {
					classes: filters.classes.length ? filters.classes : undefined,
					keystones: filters.keystones.length
						? filters.keystones
						: undefined,
				}
			: undefined;

	const itemFilter = {
		characterFilter: charFilter,
		slots: filters.slots.length ? filters.slots : undefined,
		rarities: filters.rarities.length ? filters.rarities : undefined,
		itemNames: filters.uniqueNames.length
			? filters.uniqueNames
			: undefined,
		baseTypes: filters.baseTypes.length ? filters.baseTypes : undefined,
		reqTypes: filters.reqTypes.length ? filters.reqTypes : undefined,
		anoints: filters.anoints.length ? filters.anoints : undefined,
	};

	const [result] = useQuery({
		query: ITEM_AGGREGATIONS_QUERY,
		variables: { filter: itemFilter },
	});

	const isUniqueOnly =
		filters.rarities.length === 1 &&
		filters.rarities[0].toLowerCase() === "unique";

	const data = result.data?.itemAggregations;

	const tableData = useMemo(() => {
		if (!data) return [];
		const rows: CountEntry[] = isUniqueOnly
			? data.byName
			: data.byBaseType;
		return [...rows].sort((a, b) => {
			const aVal = a[sortKey];
			const bVal = b[sortKey];
			if (typeof aVal === "string" && typeof bVal === "string") {
				return sortDir === "asc"
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}
			return sortDir === "asc"
				? (aVal as number) - (bVal as number)
				: (bVal as number) - (aVal as number);
		});
	}, [data, isUniqueOnly, sortKey, sortDir]);

	if (result.fetching) {
		return <p className="text-gray-500">Loading item data...</p>;
	}

	if (result.error) {
		return <p className="text-red-400">Error: {result.error.message}</p>;
	}

	if (!data) return null;

	const chartData = tableData.slice(0, 15);
	const chartTitle = isUniqueOnly ? "Top Unique Items" : "Top Base Types";
	const tableLabel = isUniqueOnly ? "Item Name" : "Base Type";

	function handleBarClick(entry: any) {
		if (!entry?.name) return;
		if (isUniqueOnly) {
			onToggle("uniqueNames", entry.name);
		} else {
			onToggle("baseTypes", entry.name);
		}
	}

	function handleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("desc");
		}
	}

	function sortIndicator(key: SortKey) {
		if (sortKey !== key) return "";
		return sortDir === "asc" ? " ↑" : " ↓";
	}

	return (
		<div className="space-y-8">
			{/* Summary */}
			<div className="flex gap-6 text-sm">
				<div>
					<span className="text-gray-500">Total items:</span>{" "}
					<strong>{data.totalCount}</strong>
				</div>
				<div>
					<span className="text-gray-500">Avg ilvl:</span>{" "}
					<strong>{data.avgIlvl}</strong>
				</div>
				<div>
					<span className="text-gray-500">Corrupted:</span>{" "}
					<strong>{data.corruptedCount}</strong>
				</div>
				<div>
					<span className="text-gray-500">Fractured:</span>{" "}
					<strong>{data.fracturedCount}</strong>
				</div>
			</div>

			{/* Top row: 2 Pie Charts (left) + Bar Chart (right) */}
			<Collapsible title="Distribution Charts" id="distribution_charts">
			<div className="flex gap-6 items-start flex-wrap">
				{/* Pie Charts column */}
				<div className="shrink-0 space-y-4">
					{/* Pie Chart: Rarity */}
					<div>
						<h2 className="text-sm font-semibold mb-2 text-gray-300">
							Rarity Distribution
						</h2>
						{data.byRarity.length > 0 && (
							<ResponsiveContainer width={250} height={220}>
								<PieChart>
									<Pie
										data={data.byRarity}
										dataKey="count"
										nameKey="name"
										cx="50%"
										cy="50%"
										outerRadius={80}
										label={({ name, percentage }) =>
											`${name} ${percentage}%`
										}
										labelLine={false}
									>
										{data.byRarity.map(
											(_: unknown, i: number) => (
												<Cell
													key={i}
													fill={
														COLORS[
															i % COLORS.length
														]
													}
												/>
											),
										)}
									</Pie>
									<Tooltip
										contentStyle={{
											background: "#1f2937",
											border: "1px solid #374151",
											color: "#e5e7eb",
										}}
										itemStyle={{ color: "#e5e7eb" }}
										labelStyle={{ color: "#e5e7eb" }}
										formatter={(_val: number, _name: string, props: any) => [
											`${props.payload.percentage}%`,
											props.payload.name,
										]}
									/>
								</PieChart>
							</ResponsiveContainer>
						)}
					</div>

					{/* Pie Chart: Base Requirements */}
					<div>
						<h2 className="text-sm font-semibold mb-2 text-gray-300">
							Base Requirements
						</h2>
						{data.byReqType.length > 0 && (
							<ResponsiveContainer width={250} height={220}>
								<PieChart>
									<Pie
										data={data.byReqType}
										dataKey="count"
										nameKey="name"
										cx="50%"
										cy="50%"
										outerRadius={80}
										label={({ name, percentage }) =>
											`${name} ${percentage}%`
										}
										labelLine={false}
									>
										{data.byReqType.map(
											(
												entry: CountEntry,
												i: number,
											) => (
												<Cell
													key={i}
													fill={
														REQ_COLORS[
															entry.name
														] ?? "#6b7280"
													}
												/>
											),
										)}
									</Pie>
									<Tooltip
										contentStyle={{
											background: "#1f2937",
											border: "1px solid #374151",
											color: "#e5e7eb",
										}}
										itemStyle={{ color: "#e5e7eb" }}
										labelStyle={{ color: "#e5e7eb" }}
										formatter={(_val: number, _name: string, props: any) => [
											`${props.payload.percentage}%`,
											props.payload.name,
										]}
									/>
								</PieChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>

				{/* Bar Chart: Top Items/Base Types */}
				<div className="flex-1 min-w-[400px]">
					<div className="flex justify-between items-center mb-2">
						<h2 className="text-sm font-semibold text-gray-300">
							{chartTitle}
							<span className="text-gray-600 font-normal ml-2 text-xs">
								(click bar to filter)
							</span>
						</h2>
						{tableData.length > 15 && (
							<button
								onClick={() => setBaseTypeFullscreen(true)}
								className="text-xs text-gray-500 hover:text-white"
							>
								⛶ Top {tableData.length}
							</button>
						)}
					</div>
					{chartData.length > 0 ? (
						<ResponsiveContainer width="100%" height={400}>
							<BarChart
								data={chartData}
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
									width={180}
									tick={{ fontSize: 13, fill: "#e5e7eb" }}
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
										_value: number,
										_name: string,
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
									onClick={(entry: any) =>
										handleBarClick(entry)
									}
								/>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<p className="text-gray-500 text-sm">
							No items match filters
						</p>
					)}
				</div>
			</div>
			</Collapsible>

			{/* Base Types Fullscreen */}
			{baseTypeFullscreen && (
				<div
					className="fixed inset-0 z-50 bg-gray-950/95 overflow-y-auto p-8"
					onKeyDown={(e) => {
						if (e.key === "Escape") setBaseTypeFullscreen(false);
					}}
					tabIndex={0}
					ref={(el) => el?.focus()}
				>
					<div className="sticky top-0 z-10 flex justify-between items-center mb-4 bg-gray-950/95 py-2">
						<h2 className="text-lg font-semibold text-gray-200">
							{chartTitle} (Top {tableData.length})
						</h2>
						<button
							onClick={() => setBaseTypeFullscreen(false)}
							className="text-gray-400 hover:text-white text-2xl px-3"
						>
							✕
						</button>
					</div>
					<ResponsiveContainer
						width="100%"
						height={tableData.length * 50}
					>
						<BarChart
							data={tableData}
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
								width={250}
								tick={{ fontSize: 14, fill: "#e5e7eb" }}
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
									_value: number,
									_name: string,
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
								onClick={(entry: any) =>
									handleBarClick(entry)
								}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}

			{/* Mod Frequency Charts */}
			<Collapsible title="Mod Frequency" id="mod_frequency">
			<div className="space-y-8 border-t border-gray-800 pt-8">
				<ModChart
					title="Top Explicit Mods"
					data={data.byExplicitMod}
					color="#6366f1"
				/>
				<ModChart
					title="Top Implicit Mods"
					data={data.byImplicitMod}
					color="#f59e0b"
				/>
				<ModChart
					title="Top Rune Mods"
					data={data.byRuneMod}
					color="#10b981"
				/>
				<ModChart
					title="Top Anoints"
					data={data.byAnoint}
					color="#a855f7"
					onBarClick={(entry) => {
						const slug = entry.name.replace(/ /g, "_");
						window.open(`https://poe2db.tw/us/${slug}`, "_blank");
					}}
				/>
			</div>
			</Collapsible>

			{/* Class Distribution (vertical bar) */}
			<Collapsible title="Class Distribution" id="class_distribution">
			{classData.length > 0 && (
				<div>
					<ResponsiveContainer width="100%" height={900}>
						<BarChart data={classData} margin={{ bottom: 60 }}>
							<XAxis
								dataKey="name"
								stroke="#e5e7eb"
								tick={({ x, y, payload }: any) => (
									<text
										x={x}
										y={y}
										dy={10}
										textAnchor="end"
										fill="#e5e7eb"
										fontSize={11}
										transform={`rotate(-45, ${x}, ${y})`}
									>
										{payload.value}
									</text>
								)}
								interval={0}
								height={80}
							/>
							<YAxis
								stroke="#e5e7eb"
								tick={{ fontSize: 13, fill: "#e5e7eb" }}
								unit="%"
							/>
							<Tooltip
								contentStyle={{
									background: "#1f2937",
									border: "1px solid #374151",
									color: "#e5e7eb",
									fontSize: 14,
								}}
								separator=""
								formatter={(_value: number, _name: string, props: any) => [
									`${props.payload.count} characters (${props.payload.percentage}%)`,
									"",
								]}
							/>
							<Bar
								dataKey="percentage"
								fill="#6366f1"
								cursor="pointer"
								onClick={(entry: any) => {
									if (entry?.name) onToggle("classes", entry.name);
								}}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}
			</Collapsible>

			{/* Base Types Table */}
			<Collapsible title={`${tableLabel}s`} id="base_types_table">
			<div className="border-t border-gray-800 pt-8">
				<div className="max-h-[400px] overflow-y-auto">
					<table className="w-full text-sm">
						<thead className="sticky top-0 bg-gray-950">
							<tr className="text-left text-gray-500 border-b border-gray-800">
								<th
									className="pb-2 cursor-pointer hover:text-white"
									onClick={() => handleSort("name")}
								>
									{tableLabel}
									{sortIndicator("name")}
								</th>
								<th
									className="pb-2 text-right cursor-pointer hover:text-white"
									onClick={() => handleSort("count")}
								>
									Count{sortIndicator("count")}
								</th>
								<th
									className="pb-2 text-right cursor-pointer hover:text-white"
									onClick={() => handleSort("percentage")}
								>
									%{sortIndicator("percentage")}
								</th>
							</tr>
						</thead>
						<tbody>
							{tableData.map((row: CountEntry) => (
								<tr
									key={row.name}
									className="border-b border-gray-800/50 hover:bg-gray-800/30"
								>
									<td className="py-1.5">{row.name}</td>
									<td className="py-1.5 text-right tabular-nums">
										{row.count}
									</td>
									<td className="py-1.5 text-right tabular-nums text-gray-400">
										{row.percentage}%
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
			</Collapsible>
		</div>
	);
}
