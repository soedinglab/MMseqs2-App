import Vue from 'vue';
import Vuetify from 'vuetify/lib';
import Portal from './lib/vue-simple-portal';
import MDI from './MDI.js';

Vue.use(Vuetify);
Vue.use(Portal);

import AppLocal from './AppLocal.vue';
const appStrings = {
    mmseqs: require('./assets/mmseqs.en_US.po').default,
    foldseek: require('./assets/foldseek.en_US.po').default,
    foldmason: require('./assets/foldmason.en_US.po').default,
};
window.document.title = appStrings[__APP__].APP_NAME + " Search Server";

const mq = window.matchMedia('(prefers-color-scheme: dark)')
const vuetify = new Vuetify({
    icons: {
        iconfont: 'mdiSvg',
    },
    theme: { dark: mq.matches },
})
mq.addEventListener('change', (e) => {
    vuetify.framework.theme.dark = e.matches;
})

Vue.use({
    install(Vue, options) {
        Vue.prototype.$APP = __APP__;
        Vue.prototype.$STRINGS = appStrings[__APP__];
        Vue.prototype.$ELECTRON = __ELECTRON__;
        Vue.prototype.$LOCAL = __LOCAL__;
        Vue.prototype.$MDI = MDI;
        Vue.prototype.__OS__ = { arch: 'web', platform: 'web' };
        Vue.prototype.mmseqsVersion = "web";
        Vue.prototype.saveResult = () => {};
        Vue.prototype.handleTitleBarDoubleClick = () => {};
    }
});

const app = new Vue({
    el: '#app',
    vuetify,
    render: h => h(AppLocal)
});

// make sure our CSS is load last
import './assets/style.css';