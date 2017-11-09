<script>
import Navigation from './Navigation.vue';

import AppElectron from './AppElectron.vue';
import AppBrowser from './AppBrowser.vue';

export default {
    mixins: [ __ELECTRON__ ? AppElectron : AppBrowser ],
    components: { Navigation },
    data: () => ({
        drawer: true,
    })
}
</script>