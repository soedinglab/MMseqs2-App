import Vue from 'vue';
import VueRouter from 'vue-router';
import VueResource from 'vue-resource';
import VueLocalStorage from 'vue-localstorage/src/index.js';

if (__ELECTRON__) {
    require('material-design-icons/iconfont/material-icons.css');
}
require('vuetify/src/stylus/app.styl');
require('vuetify/src/stylus/components/_tables.styl');

import { 
    Vuetify,
    VApp,
    VNavigationDrawer,
    VGrid,
    VList,
    VSubheader,
    VDivider,
    VIcon,
    VBtn,
    VToolbar,
    VCard,
    VForm,
    VTextField,
    VCheckbox,
    VRadioGroup,
    VDialog,
    VTooltip,
} from 'vuetify';

Vue.use(Vuetify, {
    components: {
        VApp,
        VNavigationDrawer,
        VGrid,
        VList,
        VSubheader,
        VDivider,
        VIcon,
        VBtn,
        VToolbar,
        VCard,
        VForm,
        VTextField,
        VCheckbox,
        VRadioGroup,
        VDialog,
        VTooltip,
    }
});

require('./assets/style.css');

Vue.use(VueRouter);
Vue.use(VueResource);
Vue.use(VueLocalStorage);

Vue.url.options.root = __CONFIG__.apiEndpoint;

import App from './App.vue';
import Search from './Search.vue';
import Queue from './Queue.vue';
import Queries from './Queries.vue';

const Preferences = __ELECTRON__ ? require('./Preferences.vue').default : null;

const router = new VueRouter({
    mode: __ELECTRON__ ? 'hash' : 'history',
    routes: [
        { path: '/', redirect: { name: 'search' } },
        { name: 'search', path: '/search', component: Search },
        { name: 'queue', path: '/queue/:ticket', component: Queue },
        { 
            name: 'result', path: '/result/:ticket/:entry', 
            components: {
                default: () => import('./Result.vue'),
                sidebar: Queries
            }
        },
        { name: 'preferences', path: '/preferences', component: Preferences },
    ],
    linkActiveClass: 'active'
});

Vue.use({
    install(Vue, options) {
        Vue.prototype.$ELECTRON = __ELECTRON__;
        if (__ELECTRON__) {
            const remote = require('electron').remote;
            Vue.prototype.__OS__ = { arch: remote.app.os.arch(), platform: remote.app.os.platform() };
            Vue.prototype.__SIMD__ = remote.app.simdLevel;
        } else {
            Vue.prototype.__OS__ = { arch: 'web', platform: 'web' };
            Vue.prototype.__SIMD__ = false;
        }
    }
});

const app = new Vue({
    el: '#app',
    router,
    render: h => h(App)
});