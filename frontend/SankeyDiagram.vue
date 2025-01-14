<template>
	 <div class="sankey-container">
        <svg ref="sankeyContainer" class="hide"></svg>    
        </div>
</template>

<script>
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import { sankeyRankColumns } from "./rankUtils";

export default {
	name: "SankeyDiagram",
    props: {
        rawData: {
			type: Array,
			required: true,
		},
		currentSelectedNodeId: {
			type: String,
			default: null,
		},
		db: {
			type: String,
			required: true,
		},
		currentSelectedDb: {
			type: String,
			default: null,
		}
	},
    data: () => ({
		currentSelectedNode: null, // Track the currently selected node
		unclassifiedNodes: [], // Store unclassified nodes
		
		// Data for graph rendering
		sankeyRankColumns,
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
		currentSelectedDb: {
			immediate: true,
			handler(newValue) {
				if (newValue !== this.db) {
					// Reset the selected node when switching databases
					this.currentSelectedNode = null;
					this.createSankey(this.rawData);
				}
			}
		}
    },
    methods: {
		// Function for processing/parsing data
		parseData(data, isFullGraph = false) {
			const nodes = [];
			const links = [];

			let currentLineage = []; // Track the current lineage
			const nodesByRank = {}; // Store nodes by rank

			let rootNode = null;
			this.unclassifiedNodes = [];

			// Step 1: Create nodes and save lineage data for ALL NODES
			data.forEach((d) => {
				let node = {
					id: d.taxon_id,
					taxon_id: d.taxon_id,
					name: d.name,
					rank: d.rank,
					trueRank: d.rank,
					hierarchy: d.depth,
					proportion: parseFloat(d.proportion),
					clade_reads: parseFloat(d.clade_reads),
					taxon_reads: d.taxon_reads,
					lineage: null, 
					type: "", 
				};

				// Add node to its corresponding rank collection
				// + Add root node to the "root" collection
				if (this.sankeyRankColumns.includes(d.rank)) {
					if (!nodesByRank[d.rank]) {
						nodesByRank[d.rank] = [];
					}
					nodesByRank[d.rank].push(node);
				} else if (this.isRootNode(node)) {
					nodesByRank["root"] = [node];
					node.rank = "root";
					rootNode = node;
				} else if ((node.id === '12908' && node.name === 'unclassified sequences') || (node.id === '28384' && node.name === 'other sequences')) {
					this.unclassifiedNodes.push(node);
				}

				// Store lineage for each node
				let lastLineageNode = currentLineage[currentLineage.length - 1];
				if (lastLineageNode) {
					let currentRank = node.hierarchy;
					let lastRank = lastLineageNode.hierarchy;
					
					while (lastLineageNode && currentRank <= lastRank) {
						currentLineage.pop();
						
						lastLineageNode = currentLineage[currentLineage.length - 1];
						if (!lastLineageNode) {
							break; // Exit the loop if no more nodes in the lineage
						}
						
						lastRank = lastLineageNode.hierarchy; // Update lastRank for the next iteration comparison
					}
				}
				// Append current node to currentLineage array + store lineage data
				currentLineage.push(node);
				node.lineage = [...currentLineage];
			});

			// Step 2: Filter top 10 nodes by clade_reads for each rank
			// + Add filtered rank nodes to sankey data
			this.sankeyRankColumns.forEach((rank) => {
				if (nodesByRank[rank]) {
					// Sort nodes by clade_reads in descending order and select the top nodes
					const topNodes = nodesByRank[rank].sort((a, b) => b.clade_reads - a.clade_reads).slice(0, isFullGraph ? nodesByRank[rank].length : 10);
					nodes.push(...topNodes);
				}
			});

			// Step 3: Create links based on filtered nodes' lineage
			nodes.forEach((node) => {
				// Find the previous node in the lineage that is in sankeyRankColumns
				const lineage = node.lineage;

				let previousNode = lineage[lineage.length - 2];
				while (previousNode) {
					const linkEntry = {
						sourceName: previousNode.name,
						source: previousNode.id,
						targetName: node.name,
						target: node.id,
						value: node.clade_reads,
					};

					if (this.sankeyRankColumns.includes(previousNode.rank) && nodes.includes(previousNode)) {
						links.push(linkEntry);
						break;
					}

					previousNode = lineage[lineage.indexOf(previousNode) - 1];
				}
			});

			// Step 4: Add an unclassified node under the root
			if (rootNode) {
				let totalUnclassifiedCladeReads = 0;
				let totalUnclassifiedProportion = 0;

				// Add clade reads and proportion to the total
				this.unclassifiedNodes.forEach((node) => {
					totalUnclassifiedCladeReads = totalUnclassifiedCladeReads + node.clade_reads;
					totalUnclassifiedProportion = totalUnclassifiedProportion + node.proportion;
				});

				if (totalUnclassifiedCladeReads > 0) {
					const unclassifiedNode = {
						id: "",
						taxon_id: "",
						name: "Unclassified Sequences",
						rank: this.sankeyRankColumns[this.sankeyRankColumns.indexOf(rootNode.rank)+1],
						trueRank: "unclassified",
						hierarchy: rootNode.hierarchy + 1,
						proportion: totalUnclassifiedProportion,
						clade_reads: totalUnclassifiedCladeReads,
						taxon_reads: 0,
						lineage: [rootNode],
						type: "unclassified",
					};
					unclassifiedNode.lineage.push(unclassifiedNode);
					nodes.push(unclassifiedNode);

					links.push({
						sourceName: rootNode.name,
						source: rootNode.id,
						targetName: unclassifiedNode.name,
						target: unclassifiedNode.id,
						value: totalUnclassifiedCladeReads,
					});
				}
			}

			return { nodes, links };
		},
		isRootNode(node) {
			// Check if the node is the root node
			return parseInt(node.taxon_id) === 1;
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
			if (!container || !container.parentElement) {
				// Ensure the container and its parent are accessible
				return;
			}
			d3.select(container).selectAll("*").remove(); // Clear the previous diagram

			const nodeWidth = 30;
			const nodePadding = 20;
			const marginBottom = 50; // Margin for rank labels
			const marginRight = 70;

			const width = container.parentElement.clientWidth; // Dynamically get parent width
			const height = 450;
			
			const svg = d3.select(container)
			.attr("viewBox", `0 0 ${width} ${height+marginBottom}`)
			.attr("width", "100%")
			.attr("height", height)
			.classed("hide", false);

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
			const columnWidth = (width - marginRight) / this.sankeyRankColumns.length;
			const columnMap = this.sankeyRankColumns.reduce((acc, rank, index) => {
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
			const rankLabels = [" ", "D", "K", "P", "C", "O", "F", "G", "S"];
			svg
				.append("g")
				.selectAll("text")
				.data(this.sankeyRankColumns)
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
				.attr("stroke", (d) => (d.target.type === "unclassified" ? unclassifiedLabelColor : color(d.source.color)))
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
								${d.type !== "unclassified" ? `<p style="font-size: 0.6rem; margin-bottom: 0px;">#${d.taxon_id}</p>` : ""}
								<div style="display: flex; justify-content: space-between; align-items: center;">
									<div style="font-weight: bold; font-size: 0.875rem;">${d.name}</div>
									${d.type !== "unclassified" ? `<span style="background-color: rgba(255, 167, 38, 0.25); color: #ffa726; 
																				font-weight: bold; padding: 4px 8px; border-radius: 12px; 
																				font-size: 0.875rem; margin-left: 10px;">${d.trueRank}</span>` : ''}
								</div>
								<hr style="margin: 8px 0; border: none; border-top: 1px solid #fff; opacity: 0.2;">
								<div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem;">
									<div style="font-weight: bold;">Clade Reads</div>
									<div style="margin-left: 10px;">${d.clade_reads}</div>
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

					// If the same node is clicked again, deselect it
					if (this.currentSelectedNode && this.currentSelectedNode.id === d.id) {
						this.currentSelectedNode = null;
						this.$emit("selectTaxon", { nodeId: null, descendantIds: null, db: this.db }); // Emit an empty array to show all IDs
						return;
					}

					// Highlight the selected node
					d3.select(`.taxid-${d.id} rect`)
						.style("stroke", "black")
						.style("stroke-width", "2px");

					d3.select(`.taxid-${d.id} text.label`)
						.style("font-weight", "bold");


					// Function to collect all IDs of the current node and its descendants
					const collectIds = (node) => {
						let childrenIds = [node.taxon_id];
						childrenIds = childrenIds.concat(this.findChildren(this.rawData, node));
						return childrenIds;
					};

					// Collect all taxIds for children nodes
					let allNodeIds = [];
					if (d.type === "unclassified") {
						// Handle unclassified nodes
						allNodeIds.push('0');
						this.unclassifiedNodes.forEach(node => {
							allNodeIds.push(...collectIds(node));
						});
					} else {
						// Collect IDs for other node types
						allNodeIds = collectIds(d);
					}

					// Update the currently selected node
        			this.currentSelectedNode = d;

					// Emit the IDs array
					this.$emit("selectTaxon", { nodeId: d.taxon_id, descendantIds: allNodeIds, db: this.db });
				});
			;

			// Create node rectangles
			nodeGroup
				.append("rect")
				.attr("width", (d) => d.x1 - d.x0)
				.attr("height", (d) => Math.max(1, d.y1 - d.y0))
				.attr("fill", (d) => (d.type === "unclassified" ? unclassifiedLabelColor : d.color))
				.attr("class", (d) => "node taxid-" + d.id)
				.style("cursor", "pointer")
				.style("stroke", (d) => this.currentSelectedNodeId === d.id ? "black" : null)
				.style("stroke-width", (d) => this.currentSelectedNodeId === d.id ? "2px" : "0px");

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
				.style("cursor", "pointer")
				.style("font-weight", (d) =>  "normal");

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
				.text((d) => this.formatCladeReads(d.clade_reads))
				.style("cursor", "pointer");
		},

		formatCladeReads(value) {
			if (value >= 1000) {
				return `${(value / 1000).toFixed(2)}k`;
			}
			return value.toString();
		},
		findChildren(rawData, selectedNode) {
			const filteredTaxIds = [];
			let startAdding = false;
			const selectedNodeRank = selectedNode.hierarchy; 

			for (let i = 0; i < rawData.length; i++) {

				const comparingNode = rawData[i];
				if (comparingNode.taxon_id === selectedNode.taxon_id) {
					// Start adding child nodes from here
					startAdding = true;
					continue; // Move to the next iteration to skip the current node
				}

				if (startAdding) {
  					const comparingNodeDepth = comparingNode.depth;
					  if (comparingNodeDepth > selectedNodeRank) {
						filteredTaxIds.push(comparingNode.taxon_id);
					} else {
						// Stop when we encounter a node at the same or higher rank
						break;
					}
				}
			}

			return filteredTaxIds;
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
.theme--dark svg {
	fill: white;
}
.theme--light svg  {
	fill: black;
}

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