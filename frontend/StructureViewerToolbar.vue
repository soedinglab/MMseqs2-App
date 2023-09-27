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
        <v-icon v-bind="toolbarIconProps" style='color: #1E88E5;' v-if="showQuery === 0">{{ ($LOCAL) ? $MDI.CircleHalf : $MDI.CircleOneThird }}</v-icon>
        <v-icon v-bind="toolbarIconProps" style='color: #1E88E5;' v-else-if="!$LOCAL && showQuery === 1">{{ $MDI.CircleTwoThird }}</v-icon>
        <v-icon v-bind="toolbarIconProps" style='color: #1E88E5;' v-else>{{ $MDI.Circle }}</v-icon>
        <span v-if="isFullscreen">&nbsp;Toggle full query</span>
  </v-btn>
    <v-btn
        v-if="!disableTargetButton"
        v-bind="toolbarButtonProps"
        @click="handleClickToggleTarget"
        title="Toggle between the entire target structure and aligned region"
    >
        <v-icon v-bind="toolbarIconProps" style='color: #FFC107;' v-if="showTarget == 'aligned'">{{ $MDI.CircleHalf }}</v-icon>
        <v-icon v-bind="toolbarIconProps" style='color: #FFC107;' v-else>{{ $MDI.Circle }}</v-icon>
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
        showArrows: { type: Boolean, default: false },
        showTarget: { type: String, default: 'aligned' },
        isFullscreen: { type: Boolean, default: false },
        disablePDBButton: { type: Boolean, default: false },
        disableSpinButton: { type: Boolean, default: false },
        disableImageButton: { type: Boolean, default: false },
        disableQueryButton: { type: Boolean, default: false },
        disableTargetButton: { type: Boolean, default: false },
        disableArrowButton: { type: Boolean, default: false },
        disableResetButton: { type: Boolean, default: false },
        disableFullscreenButton: { type: Boolean, default: false },
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
</style>