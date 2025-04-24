<template>
<div style="padding: 10px; height: inherit; width: 100%; overflow-y: auto;" ref="parentDiv">
    <canvas
        id="tree"
        :class="canvasClass"
        @click="handleClick"
        @mousemove="handleMouseOver"
        @mouseleave="handleMouseLeave"
    />
</div>
</template>

<script>
import { tryFixName, debounce } from './Utilities'; 

function sortTreeByLeafOrder(tree, leafOrder) {

    function findDeepestLeafIndex(node) {
        if (!node.branches || node.branches.length === 0) {
            return leafOrder.indexOf(node.name);
        }
        return Math.min(...node.branches.map(findDeepestLeafIndex));
    }

    function sortNode(node) {
        if (!node.branches || node.branches.length === 0) {
            return; // Leaf node, no action needed
        }

        // Ensure each child is sorted
        node.branches.forEach(sortNode);

        // Compare the deepest leaf index of each child
        let leftIndex = findDeepestLeafIndex(node.branches[0]);
        let rightIndex = findDeepestLeafIndex(node.branches[1]);

        // Swap children if necessary
        if (leftIndex > rightIndex) {
            [node.branches[0], node.branches[1]] = [node.branches[1], node.branches[0]];
        }
    }

    // Start the sorting process from the root
    sortNode(tree);
    return tree;
}

// TODO sort by MSA order
// highlight selected sequences
function parseNewick(newick, order) {
    let tokens = newick.split(/\s*(;|\(|\)|,|:)\s*/);
    let stack = [];
    let tree = {};
    let current_node = tree;
    let headers = [];
    for (let token of tokens) {
        switch (token) {
            case '(': // new branch set
                let branch = { height: 1 };
                current_node.branches = [branch];
                stack.push(current_node);
                current_node = branch;
                break;
            case ',': // another branch
                branch = { height: 1 };
                stack[stack.length - 1].branches.push(branch);
                current_node = branch;
                break;
            case ')': // end of branch set
                current_node = stack.pop();
                if (current_node.branches) {
                    current_node.height = countLeaves(current_node);
                }
                break;
            case ';':
                break;
            default: // leaf or branch name
                if (token.length > 0) {
                    current_node.name = tryFixName(token);
                    headers.push(current_node.name);
                }
                break;
        }
    }
    // sortTree(tree);
    tree = sortTreeByLeafOrder(tree, order)
   
    // printNode(tree)
    return { tree, headers };
}

function printNode(node) {
    console.log(node)
    if (!node.branches) {
        return;
    }
    for (let child of node.branches) {
        printNode(child) 
    }
}

function countLeaves(node) {
    if (!node.branches || node.branches.length === 0) {
        return 1;
    }
    let leaves = 0;
    node.branches.forEach(child => {
        leaves += countLeaves(child);
    });
    return leaves;
}

function calculateTreeDepth(node, currentDepth=0) {
    if (!node) return currentDepth;
    if (!node.branches || node.branches.length === 0) return currentDepth;
    let depth = currentDepth;
    node.branches.forEach(child => {
        depth = Math.max(depth, calculateTreeDepth(child, currentDepth + 1));
    });
    return depth;
}
   
export default {
    data() {
        return {
            tree: {},
            headers: [],
            resizeObserver: null,
            headerStartX: null,
            isHovering: false
        }
    },
    props: {
        newick: { type: String },
        selection: { type: Array },
        reference: { type: Number },
        order: { type: Array },
        labelWidth: { type: Number },
        labelHeight: { type: Number },
        fontNormal: { type: String, default: "normal 12px sans-serif" },
        fontSelected: { type: String, default: "normal 600 12px sans-serif" },
        referenceColor: { type: String, default: "#1E88E5" },
        selectionColor: { type: String, default: "#E6AC00" },
        maxHeaderChars: { type: Number, default: 25 }
    },
    computed: {
        strokeStyle() {
            return this.$vuetify.theme.dark ? 'white' : 'black';
        },
        canvasClass() {
            return this.isHovering ? "hover" : "";
        }
    },
    watch: {
        'tree': function() {
            this.visualiseTree();
        },
        '$vuetify.theme.dark': function() {
            this.visualiseTree();
        },
        'selection': function() {
            this.visualiseTree();
        },
    },
    methods: {
        drawElbowConnector(ctx, startX, startY, endX, endY) {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(startX, endY); // Vertical line
            ctx.lineTo(endX, endY);   // Horizontal line
            ctx.strokeStyle = this.strokeStyle;
            ctx.stroke();
            ctx.closePath();
        },
        isSelection(node) {
            if (!this.selection) return false;
            return (this.selection.includes(node.name));
        },
        isReference(node) {
            if (this.reference === undefined || this.reference === -1) return false;
            return (node.name === this.order[this.reference]);
        },
        drawTree(ctx, node, startX, startY, length, headerHeight, depth=0, childIndex=0, fullWidth=100) {
            const endX = (!node.branches ? fullWidth : startX + length);
            const endY = startY + headerHeight * (
                childIndex === 0
                    ? -(node.branches ? node.branches[1].height : 0.5)
                    : +(node.branches ? node.branches[0].height : 0.5)
            );
            this.drawElbowConnector(ctx, startX, startY, endX, endY);
            if (node.branches) {
                for (let i = 0; i < node.branches.length; i++) {
                    this.drawTree(ctx, node.branches[i], endX, endY, length, headerHeight, depth + 1, i, fullWidth);
                }
            } else {
                if (this.selection) {
                    ctx.font = this.isSelection(node) ? this.fontSelected : this.fontNormal;
                    ctx.fillStyle = this.isSelection(node)
                        ? (this.isReference(node) ? this.referenceColor : this.selectionColor)
                        : this.strokeStyle;
                }
                let name = (node.name.length > this.maxHeaderChars)
                    ? `${node.name.substring(0, this.maxHeaderChars)}…`
                    : node.name;
                ctx.fillText(name, endX + 5, endY + 4);
            }
        },
        clearTree() {
            let canvas = document.getElementById('tree');
            let ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
        visualiseTree() {
            let canvas = document.getElementById('tree');
            if (!canvas) {
                return;
            }
            let ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = this.strokeStyle;
            ctx.font = this.fontSelected;  // Calculate width bolded
            
            // Calculate spacing for header substrings of length maxHeaderChars
            // +extra to account for ellipsis
            let headerWidth = 0;
            let headerHeight = 0;
            this.headers.forEach(header => {
                let { width, fontBoundingBoxAscent } = ctx.measureText(header.substring(0, this.maxHeaderChars + 3));
                headerWidth = Math.max(headerWidth, width);
                headerHeight = Math.max(headerHeight, fontBoundingBoxAscent);
            });
            headerHeight *= 2
            
            canvas.style.width = '100%';
            canvas.style.height = `${this.headers.length * headerHeight}px`;

            let depth = calculateTreeDepth(this.tree);
            let fullWidth = canvas.offsetWidth - headerWidth;
            let length = fullWidth / (depth + 1);
            
            // Store x position where headers start being drawn
            // Used when identifying header on click
            this.headerStartX = fullWidth;

            // Prevent blurriness on high DPI displays
            const ratio = window.devicePixelRatio;
            canvas.height = this.headers.length * headerHeight * ratio;
            canvas.width = canvas.offsetWidth * ratio;
            ctx.scale(ratio, ratio);

            ctx.font = this.fontNormal;
            this.drawTree(ctx, this.tree, -5, this.headers.length * headerHeight, length, headerHeight, 0, 0, fullWidth);           
            
            // Reposition tree if there is a clash with the parent container label
            const imageData = ctx.getImageData(0, 0, this.labelWidth * ratio, this.labelHeight * ratio);
            let clashDetected = imageData.data.some(v => v > 0);
            if (clashDetected) {
                canvas.style.position = 'relative'
                canvas.style.top = `${this.labelHeight}px`
            } else {
                canvas.style.top = "0px"
            }
        },
        handleClick(event) {
            if (event.layerX > this.headerStartX) {
                const canvas = event.target;
                const divHeight = canvas.height / this.headers.length;
                const index = Math.floor(event.offsetY * window.devicePixelRatio / divHeight);
                const status = (this.selection.length === 0 || event.altKey) ? "newStructureReference" : "newStructureSelection";
                this.$emit(status, index);
            }
        },
        handleMouseOver(event) {
            this.isHovering = (event.layerX > this.headerStartX);
        },
        handleMouseLeave() {
            this.isHovering = false;
        }
    },
    mounted() {
        let { tree, headers } = parseNewick(this.newick, this.order)
        this.tree = tree;
        this.headers = headers;
        this.resizeObserver = new ResizeObserver(debounce(this.visualiseTree, 200)).observe(this.$refs.parentDiv);
    },
    beforeDestroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}
</script>

<style>
canvas {
    image-rendering: pixelated;
    cursor: auto;
}
canvas.hover {
    cursor: pointer;
}
</style>