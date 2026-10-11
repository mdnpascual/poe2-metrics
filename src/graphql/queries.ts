import { gql } from "urql";

export const FILTER_OPTIONS_QUERY = gql`
	query FilterOptions($filter: ItemFilter) {
		filterOptions(filter: $filter) {
			totalCharacters
			totalItems
			latestData
			league
			classes {
				name
				count
				percentage
			}
			slots {
				name
				count
				percentage
			}
			rarities {
				name
				count
				percentage
			}
			keystones {
				name
				count
				percentage
			}
			uniqueNames {
				name
				count
				percentage
			}
			reqTypes {
				name
				count
				percentage
			}
			anoints {
				name
				count
				percentage
			}
			baseTypes {
				name
				count
				percentage
			}
		}
	}
`;

export const ITEM_AGGREGATIONS_QUERY = gql`
	query ItemAggregations($filter: ItemFilter) {
		itemAggregations(filter: $filter) {
			totalCount
			avgIlvl
			corruptedCount
			fracturedCount
			byBaseType {
				name
				count
				percentage
			}
			byName {
				name
				count
				percentage
			}
			byRarity {
				name
				count
				percentage
			}
			byReqType {
				name
				count
				percentage
			}
			byExplicitMod {
				name
				count
				percentage
			}
			byImplicitMod {
				name
				count
				percentage
			}
			byRuneMod {
				name
				count
				percentage
			}
			byAnoint {
				name
				count
				percentage
			}
		}
	}
`;


export const ITEM_MODS_QUERY = gql`
	query ItemMods($filter: ItemFilter, $limit: Int) {
		itemMods(filter: $filter, limit: $limit) {
			explicitMods
			fracturedMods
			craftedMods
			desecratedMods
			enchantMods
			implicitMods
			runeMods
		}
	}
`;
