/** Full rank order used for sorting/ordering of hierarchy */
export const rankOrderFull = [
	"superkingdom",
	"kingdom",
	"subkingdom",
	"superphylum",
	"phylum",
	"subphylum",
	"superclass",
	"class",
	"subclass",
	"superorder",
	"order",
	"suborder",
	"infraorder",
	"parvorder",
	"superfamily",
	"family",
	"subfamily",
	"supergenus",
	"genus",
	"subgenus",
	"superspecies",
	"species",
	"subspecies",
	"no rank",
	"clade",
];

/** Ranks displays as levels/columns on sankey diagram
 * Include 'no rank' for nodes displayed on sankey */
export const sankeyRankColumns = ["superkingdom", "kingdom", "phylum", "class", "order", "family", "genus", "species"];

const rankColors = [
	// Superkingdom
	"#57291F",
	"#E63A06",
	"#EE9595",
	// Superphylum
	"#FF6200",
	"#FF9200",
	"#F7B267",
	// Superclass
	"#E8B600",
	"#FFD000",
	"#E6DB6A",
	// Superorder
	"#044036",
	"#0A7A26",
	"#46A74B",
	"#86B614",
	"#ABE188",
	// Superfamily
	"#0065A2",
	"#00A5E3",
	"#77D0D0",
	// Supergenus
	"#520073",
	"#9C47B0",
	"#C792C7",
	// Superspecies
	"#FD4BB9",
	"#F389F3",
	"#FAB3E3",
	// No rank
	"#8A9BA7",
	// Clade
	"#696B73",
];

/** Function to retrieve color corresponding to rank */
export function getRankColor(rank) {
	const rankIndex = rankOrderFull.indexOf(rank);
	return rankColors[rankIndex % rankColors.length];
}
