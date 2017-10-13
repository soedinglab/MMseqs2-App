require('./assets/uniclust.less');

import Vue from 'vue';
import VueRouter from 'vue-router';
import VueResource from 'vue-resource';

// if (__ELECTRON__ && typeof localStorage === "undefined" || localStorage === null) {
//     var LocalStorage = require('node-localstorage').LocalStorage;
//     localStorage = new LocalStorage('./scratch');
// }
 
import VueLocalStorage from 'vue-localstorage/src/index.js';

require('vuetify/src/stylus/app.styl')

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
    VProgressCircular,
    VDataTable,
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
        VProgressCircular,
        VDataTable,
    }
});

Vue.use(VueRouter);
Vue.use(VueResource);
Vue.use(VueLocalStorage)

Vue.url.options.root = __CONFIG__.apiEndpoint;

import App from './App.vue';
import Search from './Search.vue';
import Queue from './Queue.vue';
import Result from './Result.vue';
import Queries from './Queries.vue';

const router = new VueRouter({
    mode: 'history',
    routes: [
        { path: '/', component: Search },
        { name: 'queue', path: '/queue/:ticket', component: Queue },
        { 
            name: 'result', path: '/result/:ticket/:entry', 
            components: {
                default: Result,
                sidebar: Queries
            }
        },
    ],
    linkActiveClass: 'active'
});

// const eventHub = new Vue();
// eventHub: eventHub,
Vue.mixin({ computed: { '__ELECTRON__': () => __ELECTRON__ }});

const app = new Vue({
    el: '#app',
    router,
    render: h => h(App)
})
