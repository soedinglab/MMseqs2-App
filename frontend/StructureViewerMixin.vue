<script>
import { Stage } from 'ngl';

export default {
    data: () => ({
        stage: null,
        isFullscreen: false,
    }),
    props: {
        bgColorLight: { type: String, default: "white" },
        bgColorDark: { type: String, default: "#1E1E1E" },
        transitionDuration: 100
    },
    computed: {
        bgColor() {
            return this.$vuetify.theme.dark ? this.bgColorDark : this.bgColorLight;
        },
        ambientIntensity() {
            this.$vuetify.theme.dark ? 0.4 : 0.2;
        },
        stageParameters: function() {
            return {
                log: 'none',
                backgroundColor: this.bgColor,
                transparent: true,
                ambientIntensity: this.ambientIntensity,
                clipNear: -1000,
                clipFar: 1000,
                fogFar: 1000,
                fogNear: -1000,
                quality: 'high'
            }
        }
    },
    mounted() {
        this.initialiseStage();
    },
    beforeDestroy() {
        this.teardownStage();
    },
    methods: {
        makePDB() {
            console.warn(`makePDB() not implemented in ${this.$options.name}`);
        },
        makeImage() {
            console.warn(`makeImage() not implemented in ${this.$options.name}`);
        },
        resetView() {
            if (!this.stage) return;
            // this.setSelection(this.showTarget)
            this.stage.autoView(this.transitionDuration);
        },
        handleResize() {
            if (!this.stage) return;
            this.stage.handleResize();
        },
        handleToggleFullscreen() {
            if (!this.stage) return;
            this.stage.toggleFullscreen(this.$refs.structurepanel);
        },
        handleResetView() {
            // this.setSelection(this.showTarget)
            this.resetView();
        },
        initialiseStage() {
            window.addEventListener('resize', this.handleResize)
            this.stage = new Stage(this.$refs.viewport, this.stageParameters);
            this.stage.signals.fullscreenChanged.add((isFullscreen) => {
                if (isFullscreen) {
                    this.stage.viewer.setBackground('#ffffff');
                    this.stage.viewer.setLight(undefined, undefined, undefined, 0.2);
                    this.isFullscreen = true;
                } else {
                    this.stage.viewer.setBackground(this.bgColor);
                    this.stage.viewer.setLight(undefined, undefined, undefined, this.ambientIntensity);
                    this.isFullscreen = false;
                }
            })   
        },
        teardownStage() {
            window.removeEventListener('resize', this.handleResize)
            if (!this.stage) return;
            this.stage.dispose() 
        },
        handleMakeImage() {
            this.makeImage();
        },
        handleMakePDB() {
            this.makePDB();
        }
    }
}
</script>

<style>
</style>