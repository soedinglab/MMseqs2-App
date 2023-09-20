<template>
<div class="toolbar-panel">
    <v-item-group class="v-btn-toggle" :light="isFullscreen">
    <v-btn
        v-if="!disablePDBButton"
        v-bind="toolbarButtonProps"
        @click="handleClickMakePDB"
        title="Save PDB"
    >
        <v-icon v-bind="toolbarIconProps">M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14Zm0 8v-.8c0-.7-.6-1.2-1.3-1.2h-2.4v6h2.4c.7 0 1.2-.5 1.2-1.2v-1c0-.4-.4-.8-.9-.8.5 0 1-.4 1-1Zm-9.7.5v-1c0-.8-.7-1.5-1.5-1.5H5.3v6h1.5v-2h1c.8 0 1.5-.7 1.5-1.5Zm5 2v-3c0-.8-.7-1.5-1.5-1.5h-2.5v6h2.5c.8 0 1.5-.7 1.5-1.5Zm3.4.3h-1.2v-1.2h1.2v1.2Zm-5.9-3.3v3h1v-3h-1Zm-5 0v1h1v-1h-1Zm11 .9h-1.3v-1.2h1.2v1.2Z</v-icon>
        <span v-if="isFullscreen">&nbsp;Save PDB</span>
    </v-btn>
    <v-btn
        v-if="!disableImageButton"
        v-bind="toolbarButtonProps"
        @click="handleClickMakeImage"
        title="Save image"
    >
        <v-icon v-bind="toolbarIconProps">M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M9 11.5C9 12.3 8.3 13 7.5 13H6.5V15H5V9H7.5C8.3 9 9 9.7 9 10.5V11.5M14 15H12.5L11.5 12.5V15H10V9H11.5L12.5 11.5V9H14V15M19 10.5H16.5V13.5H17.5V12H19V13.7C19 14.4 18.5 15 17.7 15H16.4C15.6 15 15.1 14.3 15.1 13.7V10.4C15 9.7 15.5 9 16.3 9H17.6C18.4 9 18.9 9.7 18.9 10.3V10.5H19M6.5 10.5H7.5V11.5H6.5V10.5Z</v-icon>
        <span v-if="isFullscreen">&nbsp;Save image</span>
    </v-btn>
    <v-btn
        v-if="!disableQueryButton"
        v-bind="toolbarButtonProps"
        @click="handleClickCycleQuery"
        title="Toggle between the entire query structure and aligned region"
    >
        <v-icon v-bind="toolbarIconProps" style='color: #1E88E5;' v-if="showQuery === 0">{{ ($LOCAL) ? $MDI.CircleHalf : "M12 12 V2 A10 10 0 0 0 3.858 17.806 Z" }}</v-icon>
        <v-icon v-bind="toolbarIconProps" style='color: #1E88E5;' v-else-if="!$LOCAL && showQuery === 1">M12 12 V2 A10 10 0 1 0 20.142 17.806 Z</v-icon>
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
        disableImageButton: { type: Boolean, default: false },
        disableQueryButton: { type: Boolean, default: false },
        disableTargetButton: { type: Boolean, default: false },
        disableArrowButton: { type: Boolean, default: false },
        disableResetButton: { type: Boolean, default: false },
        disableFullscreenButton: { type: Boolean, default: false },
    },
    computed: {
        toolbarIconProps: function() {
            return (this.isFullscreen) ? { 'right': true } : {}
        },
        toolbarButtonProps: function() {
            return (this.isFullscreen) ? {
                'small': false,
                'style': 'margin-bottom: 15px;',
            } : {
                'small': true,
                'style': ''
            }
        },
    },
    methods: {
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