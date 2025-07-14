<template>
    <v-flex class="d-flex flex-row" style="gap: 24px">
        <v-checkbox
            label="Cluster"
            persistent-hint
            v-model="dbScan"
        >
        </v-checkbox>
        <v-text-field
            label="Clustering Min Points"
            v-model="dbScanMinPts"
            persistent-hint
            type="number"
            min="0"
        >
        </v-text-field>
        <v-text-field
            label="Clustering Epsilion"
            v-model="dbScanEpsilion"
            persistent-hint
            type="number"
            min="0"
        >
        </v-text-field>
    </v-flex>
</template>

<script>
import { splitAlphaNum } from './Utilities.js';

function dbscan(points, epsilon = 1, minPoints = 2, distance = null) {
    const labels = new Array(points.length).fill(undefined);
    let clusterId = 0;

    for (let i = 0; i < points.length; i++) {
        if (labels[i] !== undefined) {
            continue;
        }

        const neighbors = regionQuery(points, i, epsilon, distance);
        if (neighbors.length < minPoints) {
            // mark as noise
            labels[i] = -1;
            continue;
        }

        clusterId++;
        labels[i] = clusterId;

        const seedSet = [...neighbors];
        while (seedSet.length) {
            const current = seedSet.pop();
            if (labels[current] === -1) {
                 // noise becomes part of cluster
                labels[current] = clusterId;
            }

            if (labels[current] !== undefined) {
                continue;
            }

            labels[current] = clusterId;
            const currentNeighbors = regionQuery(points, current, epsilon, distance);
            if (currentNeighbors.length >= minPoints) {
                seedSet.push(...currentNeighbors);
            }
        }
    }

    return labels;
}

function regionQuery(points, index, epsilon, distance) {
    const eps2 = epsilon * epsilon;
    const neighbors = [];
    for (let i = 0; i < points.length; i++) {
        if (distance(points[index], points[i]) <= eps2) {
            neighbors.push(i);
        }
    }
    return neighbors;
}

export default {
    name: 'FolddiscoCluster',
    props: {
        hits: {
            type: Object,
            required: false,
        },
    },
    data() {
        return {
            dbScan: false,
            dbScanEpsilion: 8,
            dbScanMinPts: 3,
        }
    },
    computed: {
        clusters() {
            return this.cluster(this.hits, this.dbScan, this.dbScanEpsilion, this.dbScanMinPts);
        }
    },
    watch: {
        clusters(newVal) {
            this.$emit('cluster', newVal);
        }
    },
    mounted() {
        this.$emit('cluster',
            this.cluster(this.hits, this.dbScan, this.dbScanEpsilion, this.dbScanMinPts)
        )
    },
    methods: {
        cluster(hits, doCluster, epsilon, minPoints) {
            let clusters = {};
            if (!hits) {
                return clusters;
            }

            if (!doCluster) {
                clusters = { 1: Object.keys(hits.alignments) };
                return clusters;
            }

            let distances = [];
            for (let hit of Object.keys(hits.alignments)) {
                const splitTarget = hits.alignments[hit][0].targetresidues.split(',');
                let [ c, pos, sub ] = splitAlphaNum(splitTarget[0]);
                let lastChain = c;
                let lastPos = pos | 0;
                let dist = [];
                let acc = 0;
                splitTarget.slice(1).map(curr => {
                    if (curr == '_') {
                        dist.push(null);
                        return;
                    }
                    let [ c, pos, sub ] = splitAlphaNum(curr);
                    if (c != lastChain) {
                        acc += lastPos;
                    }
                    pos = (pos | 0) + acc;
                    dist.push(pos - lastPos);
                    lastChain = c;
                    lastPos = pos;
                });
                distances.push(dist);
            }
            let clust = dbscan(
                distances, epsilon, minPoints,
                (x, y) => {
                    let sum = 0;
                    for (let i = 0; i < Math.min(x.length, y.length); i++) {
                        let a = x[i] ?? 10000;
                        let b = y[i] ?? 10000;
                        const d = a - b;
                        sum += d * d;
                    }
                    return sum;
                }
            )
            Object.keys(hits.alignments).forEach((x, i) => {
                if (!(clust[i] in clusters)) {
                    clusters[clust[i]] = [];
                }
                clusters[clust[i]].push(i);
            })
            return clusters;
        }
    }
}

</script>