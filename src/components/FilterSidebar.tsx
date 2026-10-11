import { useState } from "react";
import type { Filters } from "../App";

type CountEntry = {
	name: string;
	count: number;
	percentage: number;
};

type FilterOptions = {
	classes: CountEntry[];
	slots: CountEntry[];
	rarities: CountEntry[];
	keystones: CountEntry[];
	uniqueNames: CountEntry[];
	reqTypes: CountEntry[];
	anoints: CountEntry[];
	baseTypes: CountEntry[];
};

type Props = {
	options: FilterOptions;
	filters: Filters;
	onToggle: (group: keyof Filters, value: string) => void;
};

function FilterGroup({
	title,
	items,
	selected,
	group,
	onToggle,
	showSelectAll,
}: {
	title: string;
	items: CountEntry[];
	selected: string[];
	group: keyof Filters;
	onToggle: (group: keyof Filters, value: string) => void;
	showSelectAll?: boolean;
}) {
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState("");

	if (!items.length) return null;

	const filtered = query
		? items.filter((item) =>
				item.name.toLowerCase().includes(query.toLowerCase()),
			)
		: items;

	const selectAllVisible = () => {
		for (const item of filtered) {
			if (!selected.includes(item.name)) {
				onToggle(group, item.name);
			}
		}
	};

	return (
		<div className="mb-5">
			<div className="flex items-center justify-between mb-2">
				{searching ? (
					<>
						<input
							autoFocus
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onBlur={() => {
								if (!query) setSearching(false);
							}}
							onKeyDown={(e) => {
								if (e.key === "Escape") {
									setQuery("");
									setSearching(false);
								}
							}}
							placeholder={`Search ${title}...`}
							className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 outline-none focus:border-gray-500"
						/>
						{showSelectAll && query && (
							<button
								onClick={selectAllVisible}
								className="ml-2 text-xs text-gray-500 hover:text-white"
								title="Select all visible"
							>
								+All
							</button>
						)}
					</>
				) : (
					<h3 className="text-xs font-semibold uppercase text-gray-500">
						{title}
					</h3>
				)}
				<button
					onClick={() => {
						if (searching) {
							setQuery("");
							setSearching(false);
						} else {
							setSearching(true);
						}
					}}
					className="ml-2 text-gray-500 hover:text-white text-xs"
					title="Search"
				>
					{searching ? "✕" : "🔍"}
				</button>
			</div>
			<div className="space-y-1 max-h-48 overflow-y-auto">
				{filtered.map((item) => (
					<label
						key={item.name}
						className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800 rounded px-1 py-0.5"
					>
						<input
							type="checkbox"
							checked={selected.includes(item.name)}
							onChange={() => onToggle(group, item.name)}
							className="rounded border-gray-600"
						/>
						<span className="flex-1 truncate">{item.name}</span>
						<span className="text-gray-500 text-xs tabular-nums">
							{item.count}
						</span>
					</label>
				))}
				{query && !filtered.length && (
					<p className="text-xs text-gray-600 px-1">No matches</p>
				)}
			</div>
		</div>
	);
}

export function FilterSidebar({ options, filters, onToggle }: Props) {
	const showUniques =
		filters.rarities.length === 1 &&
		filters.rarities[0].toLowerCase() === "unique";

	return (
		<div>
			<FilterGroup
				title="Class"
				items={options.classes}
				selected={filters.classes}
				group="classes"
				onToggle={onToggle}
			/>
			<FilterGroup
				title="Slot"
				items={options.slots}
				selected={filters.slots}
				group="slots"
				onToggle={onToggle}
				showSelectAll
			/>
			<FilterGroup
				title="Rarity"
				items={options.rarities}
				selected={filters.rarities}
				group="rarities"
				onToggle={onToggle}
				showSelectAll
			/>
			<FilterGroup
				title="Base Requirements"
				items={options.reqTypes}
				selected={filters.reqTypes}
				group="reqTypes"
				onToggle={onToggle}
				showSelectAll
			/>
			{showUniques && (
				<FilterGroup
					title="Unique Items"
					items={options.uniqueNames}
					selected={filters.uniqueNames}
					group="uniqueNames"
					onToggle={onToggle}
					showSelectAll
				/>
			)}
			<FilterGroup
				title="Anoints"
				items={options.anoints}
				selected={filters.anoints}
				group="anoints"
				onToggle={onToggle}
				showSelectAll
			/>
			<FilterGroup
				title="Keystone"
				items={options.keystones}
				selected={filters.keystones}
				group="keystones"
				onToggle={onToggle}
			/>
			<FilterGroup
				title="Base Type"
				items={options.baseTypes}
				selected={filters.baseTypes}
				group="baseTypes"
				onToggle={onToggle}
				showSelectAll
			/>
		</div>
	);
}
