import Vue from 'vue';
import VueRouter from 'vue-router';
import Vuetify from 'vuetify/lib';
import { create } from 'axios';
import Portal from './lib/vue-simple-portal';
import MDI from './MDI.js';

Vue.use(Vuetify);
Vue.use(Portal);

import App from './App.vue';
import Search from './Search.vue';
import ComplexSearch from './ComplexSearch.vue';
import Queue from './Queue.vue';
import Queries from './Queries.vue';

const appStrings = {
    mmseqs: require('./assets/mmseqs.en_US.po').default,
    foldseek: require('./assets/foldseek.en_US.po').default,
};
window.document.title = appStrings[__APP__].APP_NAME + " Search Server";

if (!__LOCAL__) {
    Vue.use(VueRouter);
}
const router = __LOCAL__ ? null : new VueRouter({
    mode: __ELECTRON__ ? 'hash' : 'history',
    routes: [
        { path: '/', redirect: { name: 'search' } },
        { name: 'search', path: '/search', component: Search },
        { name: 'complex', path: '/complex', component: ComplexSearch },
        { name: 'queue', path: '/queue/:ticket', component: Queue },
        { 
            name: 'result',
            path: '/result/:ticket/:entry', 
            components: {
                default: () => import('./Result.vue'),
                sidebar: Queries
            }
        },
        { name: 'preferences', path: '/preferences', component: () => __ELECTRON__ ? import('./Preferences.vue') : null },
    ],
    linkActiveClass: 'active'
});

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
        if (__ELECTRON__) {
            const remote = require('@electron/remote');
            Vue.prototype.__OS__ = remote.app.os;
            Vue.prototype.mmseqsVersion = remote.app.mmseqsVersion;
            Vue.prototype.saveResult = remote.app.saveResult;
            Vue.prototype.handleTitleBarDoubleClick = remote.app.handleTitleBarDoubleClick;
            Vue.prototype.newDatabase = remote.app.newDatabase;
        } else {
            Vue.prototype.__OS__ = { arch: 'web', platform: 'web' };
            Vue.prototype.mmseqsVersion = "web";
            Vue.prototype.saveResult = () => {};
            Vue.prototype.handleTitleBarDoubleClick = () => {};
        }

        let apiBase = "";
        let defaultHeaders = {};
        if (__ELECTRON__) {
            const remote = require('@electron/remote');
            apiBase = remote.app.apiEndpoint;
            if (remote.app.token && remote.app.token.length > 0) {
                defaultHeaders.Authorization = `Basic ${remote.app.token}`;
            }
        } else {
            apiBase = __CONFIG__.apiEndpoint;
        }
        
        const axiosConfig = {
            baseURL: apiBase,
            headers: defaultHeaders
        };

        Vue.prototype.$axios = create(axiosConfig);
    }
});

const app = new Vue({
    el: '#app',
    router,
    vuetify,
    data() {
        return {
            userData: null
        }
    },
    render: h => h(App)
});

// make sure our CSS is load last
import './assets/style.css';