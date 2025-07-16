<template>
    <v-flex class="d-flex flex-row" style="gap: 24px">
        <v-checkbox
            label="Cluster"
            persistent-hint
            v-model="dbScan"
            true-value="DBSCAN"
            false-value="None"
        ></v-checkbox>
        <!-- <v-select
            label="Algorithm"
            persistent-hint
            :items="['None', 'DBSCAN', 'OPTICS']"
            v-model="dbScan"
        ></v-select> -->
        <v-text-field
            label="Clustering Min Points"
            v-model="dbScanMinPts"
            :disabled="dbScan == 'None'"
            persistent-hint
            type="number"
            min="0"
        >
        </v-text-field>
        <v-text-field
            label="Clustering Epsilion"
            v-model="dbScanEpsilion"
            :disabled="dbScan == 'None'"
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
    const neighbors = [];
    for (let i = 0; i < points.length; i++) {
        if (distance(points[index], points[i]) <= epsilon) {
            neighbors.push(i);
        }
    }
    return neighbors;
}

function defaultDistance(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        s += d * d;
    }
    return s;
    // return Math.sqrt(s);
}

function coreDist(points, index, eps, minPts, distance) {
    const dists = [];
    for (let i = 0; i < points.length; i++) {
        const d = distance(points[index], points[i]);
        if (d <= eps) {
            dists.push(d);
        }
    }
    if (dists.length < minPts) {
        return Infinity;
    }
    dists.sort((x, y) => x - y);
    return dists[minPts - 1];
}

function pushSeed(seeds, idx, reachDist) {
    seeds.push({ idx, reachDist });
}
function popMin(seeds) {
    let best = 0;
    for (let i = 1; i < seeds.length; i++) {
        if (seeds[i].reachDist < seeds[best].reachDist) {
            best = i;
        }
    }
    return seeds.splice(best, 1)[0];
}

export function optics(
    points,
    maxEps = Infinity,
    minPts = 2,
    distance = defaultDistance
    ) {
    const N = points.length;
    const processed    = new Array(N).fill(false);
    const reachability = new Array(N).fill(Infinity);
    const coreDistance  = new Array(N).fill(Infinity);
    const ordering     = [];

    for (let p = 0; p < N; p++) {
        if (processed[p]) {
            continue;
        }
        expandClusterOrder(p);
    }

    return {
        ordering,
        reachability,
        coreDistance,
        extractClusters(epsCut) {
            const labels = new Array(N).fill(-1);
            let clusterId = 0;
            for (const idx of ordering) {
                if (reachability[idx] > epsCut) {
                    if (coreDistance[idx] <= epsCut) {
                        clusterId++;
                        labels[idx] = clusterId;
                    }
                    // else leave as noise
                } else {
                    labels[idx] = clusterId;
                }
            }
            return labels;
        }
    };

    function expandClusterOrder(start) {
        const seeds = [];
        processPoint(start, seeds);
        while (seeds.length) {
            const { idx: q } = popMin(seeds);
            processPoint(q, seeds);
        }
    }

    function processPoint(q, seeds) {
        if (processed[q]) {
            return;
        }
        processed[q] = true;

        const neighbors = regionQuery(points, q, maxEps, distance);
        coreDistance[q] = coreDist(points, q, maxEps, minPts, distance);
        ordering.push(q);

        if (coreDistance[q] === Infinity) {
            // not a core point
            return;
        }

        for (const n of neighbors) {
            if (processed[n]) {
                continue;
            }

            const newReach = Math.max(coreDistance[q], distance(points[q], points[n]));
            if (newReach < reachability[n]) {
                reachability[n] = newReach;
                pushSeed(seeds, n, newReach);
            }
        }
    }
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
            dbScan: "None",
            dbScanEpsilion: 8,
            dbScanMinPts: 2,
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
        cluster(hits, algorithm, epsilon, minPoints) {
            let clusters = {};
            if (!hits) {
                return clusters;
            }

            if (algorithm == "None") {
                clusters = { 1: Object.keys(hits.alignments) };
                return clusters;
            }

            let distances = [];
            for (let hit of Object.keys(hits.alignments)) {
                const gaps = hits.alignments[hit][0].gaps;
                const dist = hits.alignments[hit][0].interresiduedist;
                distances.push([gaps, dist]);
            }
            let clust;
            if (algorithm == "DBSCAN") {
                clust = dbscan(
                    distances, epsilon * epsilon, minPoints,
                    (x, y) => {
                        if (x[0] != y[0]) {
                            return 10000;
                        }
                        let sum = 0;
                        for (let i = 0; i < Math.min(x[1].length, y[1].length); i++) {
                            let a = x[1][i] ?? 10000;
                            let b = y[1][i] ?? 10000;
                            const d = a - b;
                            sum += d * d;
                        }
                        return sum;
                    }
                )
            } else if (algorithm == "OPTICS") {
                const { ordering, reachability, extractClusters } = optics(
                    distances, Infinity, minPoints, 
                    (x, y) => {
                        if (x[0] != y[0]) {
                            return 10000;
                        }
                        let sum = 0;
                        for (let i = 0; i < Math.min(x[1].length, y[1].length); i++) {
                            let a = x[1][i] ?? 10000;
                            let b = y[1][i] ?? 10000;
                            const d = a - b;
                            sum += d * d;
                        }
                        return sum;
                    }
                );
                clust = extractClusters(epsilon);
            } else {
                throw new Error("Not implemented")
            }
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