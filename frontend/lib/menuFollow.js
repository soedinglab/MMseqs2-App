// Keeps an open v-menu attached to an activator inside a sticky header. The menu is positioned
// against the viewport (as Vuetify does for fixed activators), so page scrolling does not carry
// it along; scroll only re-measures while the header itself is still moving.
export default {
    mounted() {
        const menu = this.$refs.menu
        menu.checkActivatorFixed = () => { menu.activatorFixed = true }
    },
    watch: {
        open(isOpen) {
            if (isOpen) {
                window.addEventListener('scroll', this.followActivator, { passive: true })
            } else {
                window.removeEventListener('scroll', this.followActivator)
            }
        },
    },
    beforeDestroy() {
        window.removeEventListener('scroll', this.followActivator)
    },
    methods: {
        followActivator() {
            this.$refs.menu?.updateDimensions()
        },
    },
}
