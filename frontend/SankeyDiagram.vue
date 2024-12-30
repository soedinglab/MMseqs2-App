<template>
	 <div class="sankey-container">
        <svg ref="sankeyContainer"></svg>    
        </div>
</template>

<script>
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import { rankOrderFull, sankeyRankColumns } from "./rankUtils";

export default {
	name: "SankeyDiagram",
    props: {
        rawData: {
			type: Array,
			required: true,
		}
    },
    data: () => ({
		// Data for graph rendering
		nonCladesRawData: null, // rawData with just clades filtered out
		allNodesByRank: {},
		rankOrderFull, // Imported from rankUtils
		rankOrder: [...sankeyRankColumns, "no rank"],
		colors: [
			"#57291F",
			"#C0413B",
			"#D77B5F",
			"#FF9200",
			"#FFCD73",
			"#F7E5BF",
			"#C87505",
			"#F18E3F",
			"#E59579",
			"#C14C32",
			"#80003A",
			"#506432",
			"#FFC500",
			"#B30019",
			"#EC410B",
			"#E63400",
			"#8CB5B5",
			"#6C3400",
			"#FFA400",
			"#41222A",
			"#FFB27B",
			"#FFCD87",
			"#BC7576",
		],
	}),
	watch: {
		rawData: {
			immediate: true,
			handler(newValue) {
				this.$nextTick(() => {
					if (newValue) {
						this.createSankey(newValue);
					}
				});
			},
		},
    },
    methods: {
		// Function for processing/parsing data
		processRawData(data) {
			if (!this.rawData || !Array.isArray(this.rawData)) {
				console.warn("rawData is not an array or is undefined", this.rawData);
				return;
			}
			this.allNodesByRank = {}; // Reset the nodes by rank

			// Filter out clades from raw data
			const nonClades = data.filter((entry) => this.rankOrderFull.includes(entry.rank) && entry.rank !== "clade");
			this.nonCladesRawData = nonClades;

			// Store nodes by rank from full data (for calculation of maxTaxaLimit)
			nonClades.forEach((node) => {
				if (!this.allNodesByRank[node.rank]) {
					this.allNodesByRank[node.rank] = [];
				}
				this.allNodesByRank[node.rank].push(node);
			});
		},
		// Function for processing/parsing data
		parseData(data, isFullGraph = true) {
			const nodes = [];
			const unclassifiedNodes = [];
			const allNodes = [];
			const links = [];
			const allLinks = [];

			const rankHierarchyFull = this.rankOrderFull.reduce((acc, rank, index) => {
				acc[rank] = index;
				return acc;
			}, {});
			let currentLineage = [];
			const nodesByRank = {}; // Store nodes by rank for filtering top 10

			// Step 1: Create nodes and save lineage data for ALL NODES (excluding clade ranks)
			data.forEach((d) => {
				let node = {
					id: d.taxon_id,
					taxon_id: d.taxon_id,
					name: d.name,
					rank: d.rank,
					trueRank: d.rank,
					proportion: parseFloat(d.proportion),
					clade_reads: parseFloat(d.clade_reads),
					taxon_reads: d.taxon_reads,
					lineage: [...currentLineage, { id: d.taxon_id, name: d.name, rank: d.rank }], // Copy current lineage
					type: "",
				};

				if (d.rank !== "no rank" && !this.isUnclassifiedTaxa(d)) {
					// Declare type as 'classified'
					node.type = "classified";

					// Add classified node to its corresponding rank collection
					if (!nodesByRank[d.rank]) {
						nodesByRank[d.rank] = [];
					}
					nodesByRank[d.rank].push(node);

					// Include all ranks for lineage tracking
					if (node.rank !== "clade") {
						let lastLineageNode = currentLineage[currentLineage.length - 1];
						if (lastLineageNode) {

							let currentRank = rankHierarchyFull[node.rank] ?? Infinity;
							let lastRank = rankHierarchyFull[lastLineageNode.rank] ?? Infinity;
								while (lastLineageNode && currentRank <= lastRank) {
								const poppedNode = currentLineage.pop();
								lastLineageNode = currentLineage[currentLineage.length - 1];

								currentRank = rankHierarchyFull[node.rank] ?? Infinity;
								lastRank = rankHierarchyFull[lastLineageNode.rank] ?? Infinity;
							}
						}
						// Append current node to currentLineage array + store lineage data
						currentLineage.push(node);
						node.lineage = [...currentLineage];
					}
				} else if (this.isUnclassifiedTaxa(d)) {
					// lineage tracking for unclassified taxa
					let currentLineageCopy = [...currentLineage];
					const parentName = d.name.replace("unclassified ", "");
					let lastLineageNode = currentLineageCopy[currentLineageCopy.length - 1];

					if (lastLineageNode) {
						while (lastLineageNode && lastLineageNode.name !== parentName) {
							currentLineageCopy.pop();
							lastLineageNode = currentLineageCopy[currentLineageCopy.length - 1];
						}
					}

					// Find the previous node in the lineage that is in rankOrder
					const parentNode = currentLineageCopy.find((n) => n.name === parentName);
					if (parentNode && parentNode === lastLineageNode) {
						const lineage = currentLineageCopy;

						let previousNode = null;
						for (let i = lineage.length - 1; i >= 0; i--) {
							// Start from the last item
							if (this.rankOrder.includes(lineage[i].rank)) {
								previousNode = lineage[i];
								break;
							}
						}

						// Determine the rank immediately to the right of this node
						const parentRankIndex = this.rankOrder.indexOf(previousNode.rank);

						// Edit properties for unclassified taxa
						const nextRank = this.rankOrder[parentRankIndex + 1];

						node.id = `dummy-${d.taxon_id}`;
						node.rank = nextRank;
						node.type = "unclassified";

						// Add unclassified node to currentLineage and save lineage data
						currentLineageCopy.push(node);
						node.lineage = [...currentLineageCopy];

						unclassifiedNodes.push(node);
					}
				}
			});

			// Step 2: Filter top 10 nodes by clade_reads for each rank in rankOrder
			// + Add filtered rank nodes & unclassified nodes to sankey diagram
			this.rankOrder.forEach((rank) => {
				if (nodesByRank[rank]) {
					// Store all nodes
					allNodes.push(...nodesByRank[rank]);

					// Sort nodes by clade_reads in descending order and select the top nodes based on slider value
					const topNodes = nodesByRank[rank].sort((a, b) => b.clade_reads - a.clade_reads).slice(0, isFullGraph ? nodesByRank[rank].length : 10); // Don't apply taxaLimit when parsing fullGraphData
					nodes.push(...topNodes);
				}
			});

			unclassifiedNodes.forEach((node) => {
				// Store in all nodes
				allNodes.push(node);

				// Add unclassified nodes to sankey
				nodes.push(node);
			});

			// Step 3: Create links based on filtered nodes' lineage
			nodes.forEach((node) => {
				// Find the previous node in the lineage that is in rankOrder
				const lineage = node.lineage;
				let previousNode = null;

				for (let i = lineage.length - 2; i >= 0; i--) {
					// Start from the second last item
					if (this.rankOrder.includes(lineage[i].rank) && nodes.includes(lineage[i])) {
						previousNode = lineage[i];
						break;
					}
				}

				if (previousNode) {
					links.push({
						source: previousNode.id,
						target: node.id,
						value: node.clade_reads,
					});
				}
			});

			// Store links for all nodes
			allNodes.forEach((node) => {
				// Find the previous node in the lineage that is in rankOrder
				const lineage = node.lineage;
				let previousNode = null;

				for (let i = lineage.length - 2; i >= 0; i--) {
					// Start from the second last item
					if (this.rankOrder.includes(lineage[i].rank) && allNodes.includes(lineage[i])) {
						previousNode = lineage[i];
						break;
					}
				}

				if (previousNode) {
					allLinks.push({
						source: previousNode.id,
						target: node.id,
						value: node.clade_reads,
					});
				}
			});

			return { nodes, links };
		},
        // Main function for rendering Sankey
		createSankey(items) {
			const { nodes, links } = this.parseData(items);
			
			// // Check if nodes and links are not empty
			if (!nodes.length || !links.length) {
				console.warn("No data to create Sankey diagram");
				return;
			}

			const container = this.$refs.sankeyContainer;
			d3.select(container).selectAll("*").remove(); // Clear the previous diagram

			const nodeWidth = 30;
			const nodePadding = 20;
			const marginBottom = 50; // Margin for rank labels
			const marginRight = 70;

			const width = container.parentElement.clientWidth; // Dynamically get parent width
			const height = 360 + marginBottom; // Fixed height for now
			
			const svg = d3.select(container)
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("width", "100%")
			.attr("height", height);

			const sankeyGenerator = sankey()
				.nodeId((d) => d.id)
				.nodeAlign(sankeyJustify)
				.nodeWidth(nodeWidth)
				.nodePadding(nodePadding)
				.iterations(100)
				.extent([
					[10, 10],
					[width - marginRight, height - 6],
				]);

			const graph = sankeyGenerator({
				nodes: nodes.map((d) => Object.assign({}, d)),
				links: links.map((d) => Object.assign({}, d)),
			});

			const color = d3.scaleOrdinal().range(this.colors);
			const unclassifiedLabelColor = "#696B7E";

			// Manually adjust nodes position to align by rank
			const columnWidth = (width - marginRight) / this.rankOrder.length;
			const columnMap = this.rankOrder.reduce((acc, rank, index) => {
				const leftMargin = 10;
				acc[rank] = index * columnWidth + leftMargin;
				return acc;
			}, {});

			graph.nodes.forEach((node) => {
				node.x0 = columnMap[node.rank];
				node.x1 = node.x0 + sankeyGenerator.nodeWidth();

				if (node.type === "unclassified") {
					node.color = unclassifiedLabelColor;
				} else {
					node.color = color(node.id); // Assign color to node
				}
			});

			// Re-run the layout to ensure correct vertical positioning
			sankeyGenerator.update(graph);

			// Add rank column labels
			const rankLabels = ["D", "K", "P", "C", "O", "F", "G", "S"];
			svg
				.append("g")
				.selectAll("text")
				// .data(rankLabels)
				.data(this.rankOrder)
				.enter()
				.append("text")
				.attr("x", (rank) => columnMap[rank] + sankeyGenerator.nodeWidth() / 2)
				.attr("y", height + marginBottom / 2)
				.attr("dy", "0.35em")
				.attr("text-anchor", "middle")
				.text((rank, index) => rankLabels[index]);

			// Draw rank label divider link
			svg
				.append("line")
				.attr("x1", 0)
				.attr("y1", height + 10)
				.attr("x2", width)
				.attr("y2", height + 10)
				.attr("stroke", "#000")
				.attr("stroke-width", 1);

			// Function to highlight lineage
			const highlightLineage = (node) => {
				const lineageIds = new Set(node.lineage.map((n) => n.id));
				lineageIds.add(node.id);

				svg.selectAll("rect").style("opacity", (d) => (lineageIds.has(d.id) ? 1 : 0.2));
				svg.selectAll("path").style("opacity", (d) => (lineageIds.has(d.source.id) && lineageIds.has(d.target.id) ? 1 : 0.2));
				svg.selectAll(".label").style("opacity", (d) => (lineageIds.has(d.id) ? 1 : 0.1));
				svg.selectAll(".clade-reads").style("opacity", (d) => (lineageIds.has(d.id) ? 1 : 0.1));
			};

			// Function to reset highlight
			const resetHighlight = () => {
				svg.selectAll("rect").style("opacity", 1);
				svg.selectAll("path").style("opacity", 1);
				svg.selectAll(".label").style("opacity", 1);
				svg.selectAll(".clade-reads").style("opacity", 1);
			};

			// // Define a clipping path for each link (crops out curve when links are too thick)
			// svg
			// 	.append("defs")
			// 	.selectAll("clipPath")
			// 	.data(graph.links)
			// 	.enter()
			// 	.append("clipPath")
			// 	// .attr("id", (d, i) => `clip-path-${this.instanceId}-${i}`)
			// 	.append("rect")
			// 	.attr("x", (d) => d.source.x1)
			// 	.attr("y", 0)
			// 	.attr("width", (d) => d.target.x0 - d.source.x1)
			// 	.attr("height", height);

			// Add links
			svg
				.append("g")
				.attr("fill", "none")
				.attr("stroke-opacity", 0.3)
				.selectAll("path")
				.data(graph.links)
				.enter()
				.append("path")
				.attr("d", sankeyLinkHorizontal())
				.attr("stroke", (d) => (d.target.type === "unclassified" ? unclassifiedLabelColor : color(d.source.color))) // Set link color to source node color with reduced opacity
				.attr("stroke-width", (d) => Math.max(1, d.width));
			// .attr("clip-path", (d, i) => `url(#clip-path-${this.instanceId}-${i})`);

			// Create node group (node + labels) and add mouse events
			const nodeGroup = svg
				.append("g")
				.selectAll(".node-group")
				.data(graph.nodes)
				.enter()
				.append("g")
				.attr("class", (d) => "node-group taxid-" + d.id)
				.attr("transform", (d) => `translate(${d.x0}, ${d.y0})`)
				.on("mouseover", (event, d) => {
    				// Highlight the lineage
					highlightLineage(d);

					// Append tooltip to the body
					const tooltip = d3.select("body")
						.append("div")
						.attr("class", "tooltip")
						.style("position", "absolute")
						.style("background-color", "rgba(38, 50, 56, 0.95)")
						.style("color", "white")
						.style("border-radius", "8px")
						.style("padding", "10px")
						.style("box-shadow", "0 2px 6px rgba(0, 0, 0, 0.1)")
						.style("opacity", 1)
						.html(`
							<div style="padding-top: 4px; padding-bottom: 4px; padding-left: 8px; padding-right: 8px;">
								<p style="font-size: 0.6rem; margin-bottom: 0px;">#${d.id}</p>
								<div style="display: flex; justify-content: space-between; align-items: center;">
									<div style="font-weight: bold; font-size: 0.875rem;">${d.name}</div>
									<span style="background-color: rgba(255, 167, 38, 0.25); color: #ffa726; font-weight: bold; padding: 4px 8px; border-radius: 12px; font-size: 0.875rem; margin-left: 10px;">${d.rank}</span>
								</div>
								<hr style="margin: 8px 0; border: none; border-top: 1px solid #fff; opacity: 0.2;">
								<div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem;">
									<div style="font-weight: bold;">Clade Reads</div>
									<div style="margin-left: 10px;">${d.value}</div>
								</div>
							</div>
						`);

					// Position the tooltip
					tooltip
					.style("left", `${event.pageX + 10}px`)
					.style("top", `${event.pageY + 10}px`);
				})
				.on("mousemove", (event, d) => {
					// Move the tooltip as the mouse moves
					d3.select(".tooltip")
						.style("left", `${event.pageX + 10}px`)
						.style("top", `${event.pageY + 10}px`);
				})
				.on("mouseout", () => {
					resetHighlight();
					// Remove the tooltip when mouse leaves
					d3.select(".tooltip").remove();
				})
				.on("click", (event, d) => {
					// Deselect any previously selected nodes
					svg.selectAll("rect.node").style("stroke", null).style("stroke-width", null);
					svg.selectAll("text.label").style("font-weight", null);

					// Highlight the selected node
					d3.select(`.taxid-${d.id} rect`)
						.style("stroke", "black")
						.style("stroke-width", "2px");

					d3.select(`.taxid-${d.id} text.label`)
						.style("font-weight", "bold");

						console.log(d);

					// Function to collect all IDs of the current node and its descendants
					const collectIds = (node) => {
						let ids = [node.id]; // Include the current node's ID
						if (node.sourceLinks) {
							// Recursively collect IDs from targetLinks (child nodes)
							node.sourceLinks.forEach((link) => {
								ids = ids.concat(collectIds(link.target));
							});
						}
						return ids;
					};

					// Collect all IDs
					const allNodeIds = collectIds(d);

					// Emit the IDs array
					console.log(allNodeIds);
					this.$emit("selectTaxon", allNodeIds);

					// Emit the selected node data if needed
					this.$emit("selectTaxon", { name: d.name, id: d.id });
				});
			;

			// Create node rectangles
			nodeGroup
				.append("rect")
				.attr("width", (d) => d.x1 - d.x0)
				.attr("height", (d) => Math.max(1, d.y1 - d.y0))
				.attr("fill", (d) => (d.type === "unclassified" ? unclassifiedLabelColor : d.color))
				.attr("class", (d) => "node taxid-" + d.id) // Apply the CSS class for cursor
				.style("cursor", "pointer");

			// Add node name labels next to node
			nodeGroup
				.append("text")
				.attr("id", (d) => `nodeName-${d.id}`)
				.attr("class", (d) => "label taxid-" + d.id)
				.attr("x", (d) => d.x1 - d.x0 + 3)
				.attr("y", (d) => (d.y1 - d.y0) / 2)
				.attr("dy", "0.35em")
				.attr("text-anchor", "start")
				.text((d) => d.name)
				.style("font-size", "9px")
				.style("cursor", "pointer");

			// Add label above node (proportion/clade reads)
			nodeGroup
				.append("text")
				.attr("id", (d) => `cladeReads-${d.id}`)
				.attr("class", "clade-reads")
				.attr("x", (d) => (d.x1 - d.x0) / 2)
				.attr("y", -4)
				.attr("dy", "0.35em")
				.attr("text-anchor", "middle")
				.style("font-size", "9px")
				.text((d) => this.formatCladeReads(d.value))
				.style("cursor", "pointer");
		},

		formatCladeReads(value) {
			if (value >= 1000) {
				return `${(value / 1000).toFixed(2)}k`;
			}
			return value.toString();
		},

		isUnclassifiedTaxa(d) {
			const name = d.name;

			// Check if the name starts with "unclassified"
			if (!name.includes("unclassified")) {
				return false;
			}

			// Split the name into words
			const words = name.trim().split(/\s+/);

			// Check if there are at least two words
			if (words.length < 2) {
				return false;
			}
			return true;
		},

		// Throttle function (used for improving performance during node hover)
		throttle(func, delay) {
			let lastCall = 0;
			return function (...args) {
				const now = new Date().getTime();
				if (now - lastCall < delay) {
					return;
				}
				lastCall = now;
				return func(...args);
			};
		},
		onResize() {
			if (this.rawData) {
				this.drawSankey(this.rawData);
			}
		},
		mounted() {
			// Listener for screen resizing event
			window.addEventListener("resize", this.onResize);
		},
		beforeUnmount() {
			window.removeEventListener("resize", this.onResize);
		},
	},
}

</script>

<style scoped>
.sankey-container {
	display: flex;
	width: 100%;
	height: auto; /* Ensure it takes full viewport height */
}
svg {
  display: block; /* Prevent extra margins caused by inline SVG */
  width: 100%;
  height: auto;
}
.sankey-diagram {
	width: 100%;
	height: auto;
	padding-bottom: 32px;
	overflow-x: scroll;
	/* Hide horizontal scrollbar for IE, Edge and Firefox */
	-ms-overflow-style: none; /* IE and Edge */
	scrollbar-width: none; /* Firefox */
}
/* Hide horizontal scrollbar for Chrome, Safari and Opera */
.sankey-diagram::-webkit-scrollbar {
	display: none;
}

svg.hide {
	display: none;
}
/* Node Hover Tooltip */
.tooltip {
	position: absolute;
	background-color: rgba(38, 50, 56, 0.95);
	padding: 10px;
	border-radius: 8px;
	color: white;
	pointer-events: none;
	z-index: 1000;
}
</style>