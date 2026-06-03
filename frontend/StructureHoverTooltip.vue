<template>
    <v-fade-transition>
        <v-card
            v-if="value"
            class="structure-hover-tooltip"
            :style="position"
            elevation="6"
        >
            <span v-if="title" class="tooltip-name">{{ title }}</span>
            <br v-if="title">
            <strong>{{ residueLabel }}</strong>
            <br v-if="locationLabel">
            <span v-if="locationLabel">{{ locationLabel }}</span>
        </v-card>
    </v-fade-transition>
</template>

<script>
function capitalize(value) {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function formatThreeLetter(value) {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '';
}

export default {
    name: 'StructureHoverTooltip',
    props: {
        value: { type: Object, default: null },
        position: {
            type: Object,
            default: () => ({
                left: '8px',
                bottom: '48px',
            }),
        },
    },
    computed: {
        residue() {
            return this.value?.residue && typeof this.value.residue === 'object'
                ? this.value.residue
                : {};
        },
        title() {
            return this.value?.name || capitalize(this.value?.side);
        },
        chain() {
            return this.residue.chain || this.value?.chain || '';
        },
        residueNumber() {
            return this.residue.residue
                ?? this.value?.authResidue
                ?? this.value?.labelResidue
                ?? (typeof this.value?.residue === 'object' ? null : this.value?.residue);
        },
        residueLabel() {
            const one = String(this.residue.oneLetter || '').trim();
            const three = formatThreeLetter(this.residue.threeLetter || this.value?.residueName);
            if (one && three) return `${one} (${three})`;
            if (three) return three;
            if (one) return one;
            return this.residueNumber != null && this.residueNumber !== ''
                ? `Residue ${this.residueNumber}`
                : 'Residue';
        },
        locationLabel() {
            const parts = [];
            if (this.chain) parts.push(`Chain ${this.chain}`);
            if (this.residueNumber != null && this.residueNumber !== '') {
                parts.push(`Residue ${this.residueNumber}`);
            }
            return parts.join(', ');
        },
    },
};
</script>

<style scoped>
.structure-hover-tooltip {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    min-width: 150px;
    max-width: min(500px, calc(100% - 16px));
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.35;
    white-space: normal;
    overflow-wrap: anywhere;
}

.tooltip-name {
    display: inline-block;
    max-width: 100%;
}
</style>
