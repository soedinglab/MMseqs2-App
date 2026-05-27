<template>
<div class="msa-config">
    <div class="config-field">
        <v-tooltip right nudge-left="15px">
            <template v-slot:activator="{ on, attrs }">
                <span class="config-label" v-bind="attrs" v-on="on">Alphabet</span>
            </template>
            <span>Switch between amino acid and 3Di alignment views</span>
        </v-tooltip>
        <v-btn-toggle
            class="alphabet-toggle"
            dense
            mandatory
            :disabled="busy || representations.length === 0"
            :value="activeRepresentationId || ''"
            @change="handleRepresentationChange"
        >
            <v-btn
                v-for="representation in representations"
                :key="representation.id"
                :value="representation.id"
                :disabled="busy"
            >
                {{ representationShortLabel(representation) }}
            </v-btn>
        </v-btn-toggle>
    </div>
    <div class="config-field">
        <v-tooltip right nudge-left="15px">
            <template v-slot:activator="{ on, attrs }">
                <span class="config-label" v-bind="attrs" v-on="on">Gaps</span>
            </template>
            <span>Hide columns with a gap fraction above this threshold</span>
        </v-tooltip>
        <input
            id="msa-gap-threshold-input"
            class="control-input"
            type="number"
            min="0"
            max="1"
            step="0.01"
            :disabled="busy"
            :value="gapThreshold"
            @input="handleGapThresholdChange"
            @change="handleGapThresholdChange"
        >
    </div>
    <div class="config-field">
        <v-tooltip right nudge-left="15px">
            <template v-slot:activator="{ on, attrs }">
                <span class="config-label" v-bind="attrs" v-on="on">Colour</span>
            </template>
            <span>Choose the colour scheme used for alignment cells</span>
        </v-tooltip>
        <v-menu
            offset-y
            :disabled="busy || schemes.length === 0"
        >
            <template v-slot:activator="{ on, attrs }">
                <v-btn
                    small
                    class="scheme-menu-button"
                    depressed
                    :disabled="busy || schemes.length === 0"
                    v-bind="attrs"
                    v-on="on"
                >
                    {{ activeSchemeLabel || "None" }}
                </v-btn>
            </template>
            <div class="scheme-menu-panel">
                <template v-for="group in schemeGroups">
                    <div
                        :key="`${group.label}:header`"
                        class="scheme-menu-heading"
                    >{{ group.label }}</div>
                    <button
                        v-for="option in group.options"
                        :key="option.id"
                        class="scheme-menu-option"
                        type="button"
                        :class="{ 'is-active': option.value === activeSchemeOptionValue }"
                        :title="option.label"
                        @click="handleSchemeChange(option.value)"
                    >
                        {{ option.shortLabel }}
                    </button>
                </template>
            </div>
        </v-menu>
    </div>
    <div class="config-field">
        <v-tooltip right nudge-left="15px">
            <template v-slot:activator="{ on, attrs }">
                <span class="config-label" v-bind="attrs" v-on="on">Tracks</span>
            </template>
            <span>Show or hide annotation tracks below the alignment</span>
        </v-tooltip>
        <v-menu
            offset-y
            :close-on-content-click="false"
            :disabled="busy || displayTracks.length === 0"
        >
            <template v-slot:activator="{ on, attrs }">
                <v-btn
                    small
                    class="track-menu-button"
                    depressed
                    :disabled="busy || displayTracks.length === 0"
                    v-bind="attrs"
                    v-on="on"
                >
                    {{ enabledTrackCount > 0 ? `${enabledTrackCount} shown` : "None" }}
                </v-btn>
            </template>
            <div class="track-menu-panel" @click.stop>
                <div class="track-menu-header">
                    <div class="track-menu-heading">Tracks</div>
                    <div class="track-menu-mode">
                        <span>{{ trackDisplayModeLabel }}</span>
                        <button
                            class="track-menu-reset"
                            type="button"
                            :aria-hidden="trackDisplayMode === 'none' ? 'false' : 'true'"
                            title="Reset to active-only"
                            @click="$emit('reset-track-defaults')"
                        >&#8635;</button>
                    </div>
                </div>
                <div class="track-menu-table">
                <div
                    v-for="track in displayTracks"
                    :key="track.id"
                    class="track-menu-row"
                >
                    <div class="track-menu-title">{{ track.label || track.id }}</div>
                    <label
                        v-for="variant in track.variants"
                        :key="`${variant.trackId}:${variant.representation || ''}`"
                        class="track-menu-option"
                        @click.stop
                    >
                        <input
                            type="checkbox"
                            :checked="variant.enabled === true"
                            @click.stop
                            @change.stop="handleTrackChange(variant, $event)"
                        >
                        <span v-if="trackVariantLabel(track, variant)">{{ trackVariantLabel(track, variant) }}</span>
                    </label>
                    <div
                        v-for="index in trackMenuFillers(track)"
                        :key="`${track.id}:filler:${index}`"
                        class="track-menu-empty"
                        aria-hidden="true"
                    ></div>
                </div>
                </div>
            </div>
        </v-menu>
    </div>
    <div class="config-field">
        <v-tooltip right nudge-left="15px">
            <template v-slot:activator="{ on, attrs }">
                <span class="config-label" v-bind="attrs" v-on="on">Selection</span>
            </template>Clear the current column selection or export it as FASTA
        </v-tooltip>
        <div class="selection-actions">
            <v-btn
                small
                depressed
                class="selection-action-button"
                :disabled="busy || selectionCount === 0"
                title="Clear selection"
                aria-label="Clear selection"
                @click="$emit('clear-selection')"
            >
                <v-icon small>{{ $MDI.CloseCircleOutline }}</v-icon>
            </v-btn>
            <v-btn
                small
                depressed
                class="selection-action-button"
                :disabled="busy || selectionCount === 0"
                title="Export selection as FASTA"
                aria-label="Export selection as FASTA"
                @click="$emit('export-selection-fasta')"
            >
                <v-icon small>{{ $MDI.FileDownloadOutline }}</v-icon>
            </v-btn>
        </div>
    </div>
</div>
</template>

<script>
export default {
    props: {
        representations: { type: Array, default: () => [] },
        activeRepresentationId: { type: String, default: null },
        schemes: { type: Array, default: () => [] },
        tracks: { type: Array, default: () => [] },
        trackDisplayMode: { type: String, default: "active-only" },
        activeScheme: { type: String, default: null },
        activeSchemeSourceRepresentationId: { type: String, default: null },
        gapThreshold: { type: Number, default: 1 },
        selectionCount: { type: Number, default: 0 },
        busy: { type: Boolean, default: false },
    },
    data() {
        return {
            displayTracks: this.cloneTracks(this.tracks),
        };
    },
    watch: {
        tracks: {
            handler(tracks) {
                this.displayTracks = this.cloneTracks(tracks);
            },
            deep: true,
        },
    },
    computed: {
        activeSchemeOptionValue() {
            if (!this.activeScheme) return "";
            const variants = this.schemes.find((scheme) => scheme.key === this.activeScheme)?.variants || [];
            const sourceId = variants.some((variant) => variant.representationId == null)
                ? null
                : this.activeSchemeSourceRepresentationId || this.activeRepresentationId;
            return this.getSchemeOptionValue(this.activeScheme, sourceId);
        },
        schemeGroups() {
            const groups = [];
            const groupByLabel = new Map();
            for (const scheme of this.schemes) {
                const label = scheme.mode === "scalar-column" ? "Column Statistics" : scheme.group || "Schemes";
                let group = groupByLabel.get(label);
                if (!group) {
                    group = { label, options: [] };
                    groupByLabel.set(label, group);
                    groups.push(group);
                }
                for (const variant of scheme.variants || []) {
                    group.options.push({
                        id: `${scheme.key}:${variant.representationId || ""}`,
                        value: this.getSchemeOptionValue(scheme.key, variant.representationId),
                        label: variant.displayLabel || scheme.label || scheme.key,
                        shortLabel: this.schemeShortLabel(scheme, variant),
                    });
                }
            }
            return groups;
        },
        activeSchemeLabel() {
            return this.schemeGroups
                .flatMap((group) => group.options)
                .find((option) => option.value === this.activeSchemeOptionValue)?.shortLabel
                || "";
        },
        enabledTrackCount() {
            return this.displayTracks
                .flatMap((track) => track.variants || [])
                .filter((variant) => variant.enabled === true)
                .length;
        },
        trackDisplayModeLabel() {
            if (this.trackDisplayMode === "active-only") return "Active only";
            if (this.trackDisplayMode === "all-supported") return "All supported";
            return "Custom";
        },
    },
    methods: {
        cloneTracks(tracks) {
            return tracks.map((track) => ({
                ...track,
                variants: (track.variants || []).map((variant) => ({ ...variant })),
            }));
        },
        handleRepresentationChange(event) {
            this.$emit("change-representation", event?.target?.value ?? event);
        },
        handleGapThresholdChange(event) {
            const value = Number(event.target.value);
            this.$emit("change-gap-threshold", Number.isFinite(value)
                ? Math.min(Math.max(value, 0), 1)
                : 0);
        },
        representationShortLabel(representation) {
            return representation.alphabetShortLabel
                || representation.shortLabel
                || representation.alphabetId
                || representation.id;
        },
        schemeShortLabel(scheme, variant) {
            const label = scheme.label || scheme.key;
            if (variant.representationId == null) {
                return label;
            }
            const representation = this.representations.find((item) => item.id === variant.representationId);
            const suffix = representation ? this.representationShortLabel(representation) : variant.alphabetShortLabel;
            return suffix ? `${label} (${suffix})` : label;
        },
        getSchemeOptionValue(scheme, representationId) {
            return JSON.stringify({
                scheme,
                schemeSourceRepresentationId: representationId || null,
            });
        },
        handleSchemeChange(event) {
            const value = event?.target?.value ?? event;
            if (!value) return;
            this.$emit("change-scheme", JSON.parse(value));
        },
        trackVariantLabel(track, variant) {
            return track.variants?.length > 1 ? (variant.label || "") : "";
        },
        trackMenuFillers(track) {
            return Math.max(0, 4 - (track.variants?.length || 0));
        },
        handleTrackChange(variant, event) {
            variant.enabled = event.target.checked;
            this.$emit("change-track", {
                trackId: variant.trackId,
                representation: variant.representation,
                enabled: event.target.checked,
            });
        },
    },
}
</script>

<style>
.msa-config {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    grid-auto-rows: 23px;
    column-gap: 8px;
    row-gap: 3px;
    align-items: center;
    font-size: 13px;
}
.config-field {
    display: contents;
}
.config-field label,
.config-label {
    font-size: 12px;
    line-height: 1.2;
    opacity: 0.72;
    align-self: center;
}
.alphabet-toggle {
    display: flex;
    width: 100%;
    height: 23px;
    min-width: 0;
    box-sizing: border-box;
    padding: 1px;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 4px;
    background: rgba(128, 128, 128, 0.08);
    overflow: hidden;
}
.alphabet-toggle .v-btn {
    flex: 1 1 0;
    width: 50%;
    height: 19px !important;
    min-width: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 3px;
    background: transparent !important;
    color: inherit !important;
    font-size: 12px;
    line-height: 1;
    letter-spacing: 0;
    text-transform: none;
}
.alphabet-toggle .v-btn--active {
    background: rgba(128, 128, 128, 0.22) !important;
}
.control-select,
.control-input {
    width: 100%;
    height: 23px;
    min-width: 0;
    box-sizing: border-box;
    padding: 0 6px;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 4px;
    background: rgba(128, 128, 128, 0.08);
    color: inherit;
    font: inherit;
    font-size: 13px;
    line-height: 1.2;
}
.control-select {
    appearance: none;
    padding-right: 20px;
    background-image:
        linear-gradient(45deg, transparent 50%, currentColor 50%),
        linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
        calc(100% - 12px) 9px,
        calc(100% - 8px) 9px;
    background-size: 4px 4px, 4px 4px;
    background-repeat: no-repeat;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.control-input {
    padding-right: 0;
}
.selection-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
    gap: 4px;
    height: 23px;
}
.selection-action-button {
    width: 100%;
    height: 23px !important;
    min-height: 23px !important;
    max-height: 23px !important;
    min-width: 0 !important;
    padding: 0 !important;
    box-sizing: border-box;
    border: 1px solid rgba(25, 118, 210, 0.35);
    border-radius: 4px;
    background: rgba(25, 118, 210, 0.08) !important;
    color: var(--v-primary-base, #1976d2) !important;
}
.selection-action-button.v-btn--disabled {
    border-color: rgba(128, 128, 128, 0.25);
    background: rgba(128, 128, 128, 0.12) !important;
    color: currentColor !important;
    opacity: 0.45;
}
.selection-action-button .v-btn__content {
    line-height: 1;
}
.scheme-menu-button,
.track-menu-button {
    width: 100%;
    height: 23px !important;
    min-width: 0;
    padding: 0 20px 0 6px !important;
    justify-self: start;
    justify-content: flex-start !important;
    border: 1px solid rgba(128, 128, 128, 0.35);
    background: rgba(128, 128, 128, 0.08) !important;
    background-image:
        linear-gradient(45deg, transparent 50%, currentColor 50%),
        linear-gradient(135deg, currentColor 50%, transparent 50%) !important;
    background-position:
        calc(100% - 12px) 9px,
        calc(100% - 8px) 9px !important;
    background-size: 4px 4px, 4px 4px !important;
    background-repeat: no-repeat !important;
    color: inherit;
    text-transform: none;
    letter-spacing: 0;
    font-size: 12px;
    line-height: 1;
}
.scheme-menu-button .v-btn__content,
.track-menu-button .v-btn__content {
    justify-content: flex-start !important;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.scheme-menu-panel {
    max-height: 320px;
    min-width: 180px;
    overflow: auto;
    padding: 8px;
    background: var(--msa-header-bg, #fff);
    color: inherit;
    border: 1px solid var(--msa-header-border, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.scheme-menu-heading {
    padding: 5px 8px 3px;
    font-size: 11px;
    font-weight: 700;
    opacity: 0.68;
    white-space: nowrap;
}
.scheme-menu-option {
    display: block;
    width: 100%;
    min-width: 0;
    padding: 5px 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    line-height: 1.2;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
}
.scheme-menu-option:hover,
.scheme-menu-option.is-active {
    background: rgba(128, 128, 128, 0.18);
}
.track-menu-panel {
    max-height: 320px;
    min-width: 0;
    overflow: auto;
    padding: 10px 12px;
    background: var(--msa-header-bg, #fff);
    color: inherit;
    border: 1px solid var(--msa-header-border, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.theme--dark .scheme-menu-panel,
.theme--dark .track-menu-panel {
    background: var(--msa-header-bg, #1e1e1e);
    color: rgba(255, 255, 255, 0.87);
    border-color: var(--msa-header-border, rgba(255, 255, 255, 0.12));
}
.track-menu-header,
.track-menu-row {
    display: grid;
    grid-template-columns: 150px repeat(4, max-content);
    column-gap: 8px;
    align-items: center;
}
.track-menu-header {
    margin-bottom: 6px;
    opacity: 0.78;
}
.track-menu-heading,
.track-menu-mode {
    font-size: 14px;
    font-weight: 600;
}
.track-menu-mode {
    grid-column: 2 / -1;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 4px;
}
.track-menu-reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    min-width: 20px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0 2px;
}
.track-menu-reset[aria-hidden="true"] {
    visibility: hidden;
    pointer-events: none;
}
.track-menu-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.track-menu-title {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    padding-right: 6px;
}
.track-menu-option {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    white-space: nowrap;
}
.track-menu-option input {
    margin: 0;
}
.track-menu-empty {
    width: 0;
    height: 0;
}
</style>
