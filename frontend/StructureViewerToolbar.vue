<template>
<div class="toolbar-panel">
    <v-item-group class="v-btn-toggle" :light="isFullscreen">
    <v-btn
        v-if="!disablePDBButton"
        v-bind="toolbarButtonProps"
        @click="handleClickMakePDB"
        title="Save PDB"
    >
        <v-icon v-bind="toolbarIconProps">{{ $MDI.SavePDB }}</v-icon>
        <span v-if="isFullscreen">&nbsp;Save PDB</span>
    </v-btn>
    <v-btn
        v-if="!disableImageButton"
        v-bind="toolbarButtonProps"
        @click="handleClickMakeImage"
        title="Save image"
    >
        <v-icon v-bind="toolbarIconProps">{{ $MDI.SavePNG }}</v-icon>
        <span v-if="isFullscreen">&nbsp;Save image</span>
    </v-btn>
    <v-btn
        v-if="!disableQueryButton"
        v-bind="toolbarButtonProps"
        @click="handleClickCycleQuery"
        title="Toggle between the entire query structure and aligned region"
    >
        <span v-if="queryColorList.length >= 2" class="two-tone-icon">
            <!-- Two copies of the mode-specific icon so BOTH chain colors are
                 always visible (bfvd-web pattern). The icon shape itself
                 changes with `showQuery`: CircleOneThird -> CircleTwoThird ->
                 Circle. Left copy is drawn in `colorList[0]`; right copy in
                 `colorList[1]`. For asymmetric glyphs (CircleOneThird /
                 CircleTwoThird / CircleHalf) we mirror the right copy with
                 `scaleX(-1)` so it fills the opposite side. For symmetric
                 glyphs (Circle) mirroring is a no-op, so we split via
                 `clip-path` instead. `mix-blend-mode: multiply` lets any
                 overlap between the two colored halves visually blend rather
                 than the top layer masking the bottom. -->
            <v-icon v-bind="toolbarIconProps"
                    :style="queryFirstHalfStyle">
                {{ queryIconName }}
            </v-icon>
            <v-icon v-bind="toolbarIconProps"
                    :style="querySecondHalfStyle">
                {{ queryIconName }}
            </v-icon>
            <!-- Invisible sizing icon so the span has intrinsic width/height. -->
            <v-icon v-bind="toolbarIconProps" style="visibility: hidden;">
                {{ queryIconName }}
            </v-icon>
        </span>
        <v-icon v-else v-bind="toolbarIconProps" :style="{ color: queryColorList[0] }">
            {{ queryIconName }}
        </v-icon>
        <span v-if="isFullscreen">&nbsp;Toggle full query</span>
  </v-btn>
    <v-btn
        v-if="!disableTargetButton"
        v-bind="toolbarButtonProps"
        @click="handleClickToggleTarget"
        title="Toggle between the entire target structure and aligned region"
    >
        <span v-if="targetColorList.length >= 2" class="two-tone-icon">
            <v-icon v-bind="toolbarIconProps"
                    :style="targetFirstHalfStyle">
                {{ targetIconName }}
            </v-icon>
            <v-icon v-bind="toolbarIconProps"
                    :style="targetSecondHalfStyle">
                {{ targetIconName }}
            </v-icon>
            <v-icon v-bind="toolbarIconProps" style="visibility: hidden;">
                {{ targetIconName }}
            </v-icon>
        </span>
        <v-icon v-else v-bind="toolbarIconProps" :style="{ color: targetColorList[0] }">
            {{ targetIconName }}
        </v-icon>
        <span v-if="isFullscreen">&nbsp;Toggle full target</span>
    </v-btn>
    <v-btn
        v-if="!disableArrowButton"
        v-bind="toolbarButtonProps"
        @click="handleClickToggleArrows"
        title="Draw arrows between aligned residues"
    >
        <v-icon v-bind="toolbarIconProps" v-if="showArrows">{{ $MDI.ArrowRightCircle }}</v-icon>
        <v-icon v-bind="toolbarIconProps" v-else>{{ $MDI.ArrowRightCircleOutline }}</v-icon>
        <span v-if="isFullscreen">&nbsp;Toggle arrows</span>
    </v-btn>
    <v-btn
        v-if="!disableResetButton"
        v-bind="toolbarButtonProps"
        @click="handleClickResetView"
        title="Reset the view to the original position and zoom level"
    >
        <v-icon v-bind="toolbarIconProps">{{ $MDI.Restore }}</v-icon>
        <span v-if="isFullscreen">&nbsp;Reset view</span>
    </v-btn>
    <v-btn
        v-if="!disableSpinButton"
        v-bind="toolbarButtonProps"
        @click="handleClickSpin"
        :disabled="isSpinning"
        title="Toggle spinning structure"
    >
        <v-icon v-bind="toolbarIconProps">{{ $MDI.AxisZRotateCounterclockwise }}</v-icon>
        <span v-if="isFullscreen">&nbsp;Toggle spin</span>
    </v-btn>
    <v-btn
        v-if="!disableFullscreenButton"
        v-bind="toolbarButtonProps"
        @click="handleClickFullscreen"
        title="Enter fullscreen mode - press ESC to exit"
    >
        <v-icon v-bind="toolbarIconProps">{{ $MDI.Fullscreen }}</v-icon>
        <span v-if="isFullscreen">&nbsp;Fullscreen</span>
    </v-btn>
    </v-item-group>
</div>
</template>

<script>
export default {
    props: {
        showQuery: { type: Number, default: 0 },
        showTarget: { type: Number, default: 0 },
        showArrows: { type: Boolean, default: false },
        isFullscreen: { type: Boolean, default: false },
        isSpinning: { type: Boolean, default: true },
        disablePDBButton: { type: Boolean, default: false },
        disableSpinButton: { type: Boolean, default: false },
        disableImageButton: { type: Boolean, default: false },
        disableQueryButton: { type: Boolean, default: false },
        disableTargetButton: { type: Boolean, default: false },
        disableArrowButton: { type: Boolean, default: false },
        disableResetButton: { type: Boolean, default: false },
        disableFullscreenButton: { type: Boolean, default: false },
        // Colors used for the query/target toggle icons. Accepts a single
        // color string OR an array of colors. When an array of >=2 colors is
        // passed the icon is rendered as a two-tone split (left half = [0],
        // right half = [1]), useful when the toggle controls multiple chains
        // with distinct colors (e.g. interface search dimer viewer).
        queryColors: { type: [String, Array], default: () => "#1E88E5" },
        targetColors: { type: [String, Array], default: () => "#FFC107" },
        // When true the query/target toggles are treated as a binary switch
        // (0 = aligned only, 1 = full) instead of the default 3-state cycle
        // (0 = aligned, 1 = full aligned chains, 2 = full complex incl.
        // non-aligned chains). Icons collapse to CircleHalf / Circle.
        binaryToggle: { type: Boolean, default: false },
    },
    computed: {
        toolbarIconProps: function() {
            return (this.isFullscreen) ? {
                'right': true
            } : {
                
            }
        },
        toolbarButtonProps: function() {
            return (this.isFullscreen) ? {
                small: false,
                style: 'margin-bottom: 15px;',
            } : {
                small: true,
                style: "width: 24px;",
            }
        },
        queryColorList: function() {
            return Array.isArray(this.queryColors) ? this.queryColors : [this.queryColors];
        },
        targetColorList: function() {
            return Array.isArray(this.targetColors) ? this.targetColors : [this.targetColors];
        },
        // Two-state icon path: CircleHalf (aligned only) vs Circle (full).
        // Used both for __LOCAL__ (which is inherently binary) and when the
        // caller opts in via `binaryToggle`.
        isBinary: function() {
            return this.$LOCAL || this.binaryToggle;
        },
        queryIconName: function() {
            if (this.isBinary) {
                return this.showQuery === 0 ? this.$MDI.CircleHalf : this.$MDI.Circle;
            }
            if (this.showQuery === 0) return this.$MDI.CircleOneThird;
            if (this.showQuery === 1) return this.$MDI.CircleTwoThird;
            return this.$MDI.Circle;
        },
        targetIconName: function() {
            if (this.isBinary) {
                return this.showTarget === 0 ? this.$MDI.CircleHalf : this.$MDI.Circle;
            }
            if (this.showTarget === 0) return this.$MDI.CircleOneThird;
            if (this.showTarget === 1) return this.$MDI.CircleTwoThird;
            return this.$MDI.Circle;
        },
        // Full `Circle` is the only symmetric shape we use, so a horizontal
        // flip would overlay identically and hide the underlying color. For
        // that case we split via clip-path instead of mirroring.
        queryIsSymmetricIcon: function() {
            return this.queryIconName === this.$MDI.Circle;
        },
        targetIsSymmetricIcon: function() {
            return this.targetIconName === this.$MDI.Circle;
        },
        queryFirstHalfStyle: function() {
            const base = { color: this.queryColorList[0], position: 'absolute' };
            if (this.queryIsSymmetricIcon) base.clipPath = 'inset(0 50% 0 0)';
            return base;
        },
        querySecondHalfStyle: function() {
            const base = { color: this.queryColorList[1], position: 'absolute', mixBlendMode: 'multiply' };
            if (this.queryIsSymmetricIcon) {
                base.clipPath = 'inset(0 0 0 50%)';
            } else {
                base.transform = 'scaleX(-1)';
            }
            return base;
        },
        targetFirstHalfStyle: function() {
            const base = { color: this.targetColorList[0], position: 'absolute' };
            if (this.targetIsSymmetricIcon) base.clipPath = 'inset(0 50% 0 0)';
            return base;
        },
        targetSecondHalfStyle: function() {
            const base = { color: this.targetColorList[1], position: 'absolute', mixBlendMode: 'multiply' };
            if (this.targetIsSymmetricIcon) {
                base.clipPath = 'inset(0 0 0 50%)';
            } else {
                base.transform = 'scaleX(-1)';
            }
            return base;
        },
    },
    methods: {
        handleClickSpin() {
            this.$emit("toggleSpin");
        },
        handleClickMakePDB() {
            this.$emit("makePDB");
        },
        handleClickMakeImage() {
            this.$emit("makeImage");
        },
        handleClickResetView() {
            this.$emit("resetView");
        },
        handleClickFullscreen() {
            this.$emit("toggleFullscreen");
        },
        handleClickCycleQuery() {
            this.$emit("toggleQuery");
        },
        handleClickToggleTarget() {
            this.$emit("toggleTarget");
        },
        handleClickToggleArrows() {
            this.$emit("toggleArrows");
        } 
    }
}
</script>

<style>
.toolbar-panel {
    display: inline-flex;
    flex-direction: row;
    position: absolute;
    justify-content: center;
    width: 100%;
    bottom: 0;
    z-index: 1;
    left: 0;
}
/* Container for the query/target two-tone icons. Sized by the invisible
   sizing icon so the button width matches the single-color case; both
   half-clipped color icons stack absolutely on top of each other. */
.two-tone-icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}
</style>