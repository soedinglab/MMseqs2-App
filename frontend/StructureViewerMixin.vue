<script>
import { MolstarStage } from './lib/molstar-stage'

export default {
    data: () => ({
        stage: null,
        isFullscreen: false,
        isSpinning: true,
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
                backgroundColor: this.bgColor,
            }
        }
    },
    watch: {
        isSpinning: function() {
            if (!this.stage) return;
            this.stage.setSpin(this.isSpinning);
        },
        bgColor: function(val) {
            if (!this.stage) return
            this.stage.setBackground(val)
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
            this.stage.focusLoci(null, this.transitionDuration);
        },
        handleResize() {
            if (!this.stage) return;
            this.stage.handleResize();
        },
        handleToggleFullscreen() {
            if (!this.stage) return;
            this.stage.toggleFullscreen(this.$refs.structurepanel);
        },
        handleToggleSpin() {
            if (!this.stage) return;
            this.isSpinning = !this.isSpinning;
        },
        handleResetView() {
            if (this.showTarget) {
                this.setSelection(this.showTarget)
            }
            this.resetView();
        },
        async initialiseStage() {
            window.addEventListener('resize', this.handleResize, { passive: true })
            document.addEventListener('fullscreenchange', this.handleFullscreenChange)
            this.stage = new MolstarStage(this.$refs.viewport, this.stageParameters)
            this.stageReady = this.stage.init()
            await this.stageReady
            this.stage.setSpin(this.isSpinning);
            if (this.stage.canvas) { 
                this.stage.canvas.addEventListener('mousedown', () => {
                    this.isSpinning = false
                })
            }

            // To ignore "STAGE LOG ..." things.
        },
        teardownStage() {
            window.removeEventListener('resize', this.handleResize)
            document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
            if (!this.stage) return;
            this.stage.dispose()
        },
        handleMakeImage() {
            this.makeImage();
        },
        handleMakePDB() {
            this.makePDB();
        },
        handleFullscreenChange() {
            this.isFullscreen = Boolean(document.fullscreenElement)
        },
    }
}
</script>

<style>
</style>