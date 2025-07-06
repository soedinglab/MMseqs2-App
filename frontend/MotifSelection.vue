<template>
    <modal-dialog
        v-model="inSelection"
        :icon="$MDI.Pencil"
    >
    <template v-slot:title>
        Edit Motif
    </template>
    
    <template v-slot:toolbar-extra>
        <v-icon v-if="motif.length > 0" title="Clear" @click="motif = ''" style="margin-right: 16px">{{ $MDI.Delete }}</v-icon>
        <v-icon @click="inSelection = false">{{ $MDI.CloseCircle }}</v-icon>
    </template>
    
    <template v-slot:text>
        <div class="mb-2" v-if="motif">
            Selected Motif:
            {{ truncated }}
            <div v-if="error" class="v-alert v-alert--outlined error--text">
                {{ error }}
            </div>
        </div>
        <div
            v-for="(chain, key) in chainMap"
            style="margin-bottom:1em"
        >
            <h3>Chain: {{ key }}</h3>
            <div class="monospace"
                @pointerup="onSpanPointerUp"
            >
            <span
                v-if="chain.length > 0 && chain[0][1] % 10 > 1"
                v-for="i in (chain[0][1] % 10) - 1"
                class="residue filler"
                >
                &nbsp;
                <br>
                &nbsp;
                <br>
                &nbsp;
            </span><span
                v-for="res in chain"
                class="residue selectable"
                :class="{
                    'active' : key in active && active[key].includes(res[1])
                }"
                :data-chain="key"
                :data-pos="res[1]"
                @click="toggleResidue(key, res[1])"
                @selectstart="toggleSpanStart(key, res[1])"
                @pointerenter="spanEnter(key, res[1])"
            >
            <span
                class="position"
                >{{ res[1] % 10 == 0 ? res[1] : '' }}</span>
                <br>
                <span class="aa">{{ res[2] }}</span>
                <br>
                <span class="ss">{{ res[3] }}</span>
            </span>
        </div>
    </div>
    </template>
</modal-dialog>
</template>

<script>
import ModalDialog from "./ModalDialog.vue";
import { splitAlphaNum } from "./Utilities";

export default {
    name: "MotifSelection",
    components: { 
        ModalDialog,
    },
    props: {
        value: {
            type: String,
            default: '',
        },
        error: {
            type: String,
            default: '',
        },
        chainMap: {
            type: Object,
            default: false
        }
    },
    data() {
        return {
            inSelection: false,
            spanStart: null,
            spanLast:  null,
        };
    },
    computed: {
        motif: {
            get() {
                return this.value ? this.value : '';
            },
            set(v) {
                this.$emit('input', v);
            }
        },
        truncated() {
            if (!this.motif) {
                return '';
            }
            let arr = this.motif.split(',');
            if (arr.length > 32) {
                return arr.slice(0, 32).join(',') + "...";
            }
            return this.motif;
        },
        active() {
            let map = {}
            this.motif
                .split(',')
                .map(x => {
                    let [chain, pos] = splitAlphaNum(x.trim());
                    if (chain in map) {
                        map[chain].push(pos - 0);
                    } else {
                        map[chain] = [ pos - 0];
                    }
                });
            return map;
        }
    },
    methods: {
        log(message) {
            console.log(message);
            return message;
        },
        toggleResidue(chain, pos) {
            const entries = this.motif
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            
            const key = `${chain}${pos}`;
            const idx = entries.findIndex(entry => {
                const [c, p] = splitAlphaNum(entry);
                return c === chain && Number(p) === pos;
            });
            
            if (idx >= 0) {
                entries.splice(idx, 1);
            } else {
                entries.push(key);
            }
            
            this.motif = entries.join(',');
        },
        toggleSpanStart(chain, pos) {
            this.spanStart = { chain, pos };
        },
        spanEnter(chain, pos) {
            this.spanLast = { chain, pos };
        },
        onSpanPointerUp(e) {
            if (!this.spanStart) {
                return;
            }

            const hits = document.elementsFromPoint(e.clientX, e.clientY);
            const span = hits.find(el =>
                el.classList?.contains('selectable')
            );

            let target;
            if (span?.dataset.chain) {
                target = {
                    chain: span.dataset.chain,
                    pos:   Number(span.dataset.pos)
                };
            } else {
                target = this.spanLast;
            }

            if (target) {
                this.toggleSpanRange(
                    target.chain,
                    this.spanStart.pos,
                    target.pos
                );
            }
            this.spanStart = null;
        },
        toggleSpanRange(chain, startPos, endPos) {
            const lo = Math.min(startPos, endPos);
            const hi = Math.max(startPos, endPos);
            
            const allPositions = this.chainMap[chain]
                .map(r => r[1])
                .filter(p => p >= lo && p <= hi);
            const currentSet = new Set(
                this.motif.split(',').map(s => s.trim()).filter(Boolean)
            );
            const activeCount = allPositions.reduce(
                (count, p) => count + (currentSet.has(`${chain}${p}`) ? 1 : 0),
                0
            );
            
            // majority active => deactivate all, else activate all
            const makeActive = activeCount <= allPositions.length / 2;
            const newSet = new Set(currentSet);
            allPositions.forEach(p => {
                const k = `${chain}${p}`;
                if (makeActive) newSet.add(k);
                else newSet.delete(k);
            });
            
            this.motif = Array.from(newSet).join(',');
        }
    }
}
</script>

<style scoped>
@font-face {
font-family: InconsolataClustal;
src: url(assets/InconsolataClustal2.woff2),
     url(assets/InconsolataClustal2.woff);
}

.residue {
    display: inline-block;
    margin-right: 5px;
    margin-bottom: 15px;
    position: relative;
    vertical-align: top;
}

.residue .aa {
    font-family: InconsolataClustal, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
}

.residue .position {
    position: absolute;
    font-weight: normal;
    font-size: 0.8em;
}

.position, .ss, .filler {
    user-select: none;
}

.selectable {
    cursor: pointer;
}

.active {
    font-weight:900;
    text-decoration: underline;
}
</style>