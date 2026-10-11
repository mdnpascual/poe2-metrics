export const typeDefs = `#graphql
	type Query {
		"""Available filter options with counts (respects current filters)"""
		filterOptions(filter: ItemFilter): FilterOptions!

		"""Aggregate item stats based on filters"""
		itemAggregations(filter: ItemFilter): ItemAggregation!

		"""Raw mod arrays for items matching filter (for client-side co-occurrence analysis)"""
		itemMods(filter: ItemFilter, limit: Int): [ItemModSet!]!

		"""Aggregate skill stats"""
		skillAggregations(filter: SkillFilter): SkillAggregation!

		"""Character defense distributions"""
		defenseDistribution(filter: CharacterFilter): DefenseDistribution!
	}

	input CharacterFilter {
		classes: [String!]
		keystones: [String!]
		minLevel: Int
		maxLevel: Int
	}

	input ItemFilter {
		characterFilter: CharacterFilter
		slots: [String!]
		rarities: [String!]
		corrupted: Boolean
		fractured: Boolean
		baseTypes: [String!]
		itemNames: [String!]
		reqTypes: [String!]
		anoints: [String!]
		modContains: String
	}

	input SkillFilter {
		characterFilter: CharacterFilter
		skillNames: [String!]
	}

	type FilterOptions {
		classes: [CountEntry!]!
		slots: [CountEntry!]!
		rarities: [CountEntry!]!
		keystones: [CountEntry!]!
		baseTypes: [CountEntry!]!
		uniqueNames: [CountEntry!]!
		reqTypes: [CountEntry!]!
		anoints: [CountEntry!]!
		totalCharacters: Int!
		totalItems: Int!
		latestData: String!
		league: String!
	}

	type CountEntry {
		name: String!
		count: Int!
		percentage: Float!
	}

	type ItemAggregation {
		totalCount: Int!
		byBaseType: [CountEntry!]!
		byName: [CountEntry!]!
		byRarity: [CountEntry!]!
		byReqType: [CountEntry!]!
		byExplicitMod: [CountEntry!]!
		byImplicitMod: [CountEntry!]!
		byRuneMod: [CountEntry!]!
		byAnoint: [CountEntry!]!
		avgIlvl: Float!
		corruptedCount: Int!
		fracturedCount: Int!
	}

	type ItemModSet {
		explicitMods: [String!]!
		fracturedMods: [String!]!
		craftedMods: [String!]!
		desecratedMods: [String!]!
		enchantMods: [String!]!
		implicitMods: [String!]!
		runeMods: [String!]!
	}

	type SkillAggregation {
		totalCount: Int!
		bySkillName: [CountEntry!]!
		bySupportGem: [CountEntry!]!
		avgDps: Float!
		dpsDistribution: [DpsBucket!]!
	}

	type DpsBucket {
		rangeMin: Int!
		rangeMax: Int!
		count: Int!
	}

	type DefenseDistribution {
		lifeHistogram: [Bucket!]!
		esHistogram: [Bucket!]!
		armourHistogram: [Bucket!]!
		evasionHistogram: [Bucket!]!
		avgLife: Float!
		avgEs: Float!
	}

	type Bucket {
		rangeMin: Int!
		rangeMax: Int!
		count: Int!
	}
`;
