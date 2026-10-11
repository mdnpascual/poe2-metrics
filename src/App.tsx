import { useState, useCallback } from "react";
import { useQuery } from "urql";
import { FilterSidebar } from "./components/FilterSidebar";
import { ItemsTab } from "./components/ItemsTab";
import { CraftingAdvisor } from "./components/CraftingAdvisor";
import { FILTER_OPTIONS_QUERY } from "./graphql/queries";

export type Filters = {
	classes: string[];
	slots: string[];
	rarities: string[];
	keystones: string[];
	uniqueNames: string[];
	baseTypes: string[];
	reqTypes: string[];
	anoints: string[];
};

const EMPTY_FILTERS: Filters = {
	classes: [],
	slots: [],
	rarities: [],
	keystones: [],
	uniqueNames: [],
	baseTypes: [],
	reqTypes: [],
	anoints: [],
};

type Tab = "items" | "crafting";

export function App() {
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
	const [activeTab, setActiveTab] = useState<Tab>("items");

	const charFilter =
		filters.classes.length || filters.keystones.length
			? {
					classes: filters.classes.length ? filters.classes : undefined,
					keystones: filters.keystones.length
						? filters.keystones
						: undefined,
				}
			: undefined;

	const fullFilter = {
		characterFilter: charFilter,
		slots: filters.slots.length ? filters.slots : undefined,
		rarities: filters.rarities.length ? filters.rarities : undefined,
		itemNames: filters.uniqueNames.length ? filters.uniqueNames : undefined,
		baseTypes: filters.baseTypes.length ? filters.baseTypes : undefined,
		reqTypes: filters.reqTypes.length ? filters.reqTypes : undefined,
		anoints: filters.anoints.length ? filters.anoints : undefined,
	};

	const [optionsResult] = useQuery({
		query: FILTER_OPTIONS_QUERY,
		variables: { filter: fullFilter },
	});

	const options = optionsResult.data?.filterOptions;

	const toggle = useCallback((group: keyof Filters, value: string) => {
		setFilters((prev) => {
			const arr = prev[group];
			const next = arr.includes(value)
				? arr.filter((v) => v !== value)
				: [...arr, value];
			return { ...prev, [group]: next };
		});
	}, []);

	const clearAll = useCallback(() => setFilters(EMPTY_FILTERS), []);

	return (
		<div className="flex h-screen">
			<aside className="w-72 border-r border-gray-800 overflow-y-auto p-4 shrink-0">
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-lg font-bold">PoE2 Metrics</h1>
					<button
						onClick={clearAll}
						className="text-xs text-gray-400 hover:text-white"
					>
						Clear all
					</button>
				</div>

				{optionsResult.fetching && (
					<p className="text-sm text-gray-500">Loading...</p>
				)}

				{options && (
					<FilterSidebar
						options={options}
						filters={filters}
						onToggle={toggle}
					/>
				)}
			</aside>

			<main className="flex-1 overflow-y-auto p-6">
				<div className="mb-4 text-sm text-gray-400">
					<div className="flex gap-4">
						<span>
							<strong className="text-white">
								{options?.totalCharacters ?? "—"}
							</strong>{" "}
							characters
						</span>
						<span>
							<strong className="text-white">
								{options?.totalItems ?? "—"}
							</strong>{" "}
							items
						</span>
					</div>
					{options?.latestData && (
						<div className="mt-1 text-xs text-gray-500">
							Latest data: {options.latestData}
						</div>
					)}
				</div>

				{/* Tab navigation */}
				<div className="flex gap-1 mb-6 border-b border-gray-800">
					<button
						onClick={() => setActiveTab("items")}
						className={`px-4 py-2 text-sm font-medium rounded-t ${
							activeTab === "items"
								? "bg-gray-800 text-white border-b-2 border-indigo-500"
								: "text-gray-500 hover:text-white"
						}`}
					>
						Items
					</button>
					<button
						onClick={() => setActiveTab("crafting")}
						className={`px-4 py-2 text-sm font-medium rounded-t ${
							activeTab === "crafting"
								? "bg-gray-800 text-white border-b-2 border-indigo-500"
								: "text-gray-500 hover:text-white"
						}`}
					>
						Crafting Advisor
					</button>
				</div>

				{activeTab === "items" && (
					<ItemsTab
						filters={filters}
						onToggle={toggle}
						classData={options?.classes ?? []}
					/>
				)}
				{activeTab === "crafting" && (
					<CraftingAdvisor
						filters={filters}
						baseTypeOptions={options?.baseTypes ?? []}
						league={options?.league ?? ""}
					/>
				)}
			</main>
		</div>
	);
}
