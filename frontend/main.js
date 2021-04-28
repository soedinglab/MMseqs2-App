import Vue from 'vue';
import VueRouter from 'vue-router';
import VueResource from 'vue-resource';
import VueLocalStorage from 'vue-localstorage/src/index.js';
import Vuetify from 'vuetify/lib';
import { 
    mdiHistory,
    mdiChevronLeft,
    mdiChevronRight,
    mdiClockOutline,
    mdiAlertCircleOutline,
    mdiHelpCircleOutline,
    mdiMagnify,
    mdiTune,
    mdiDns,
    mdiReorderHorizontal,
    mdiDelete,
    mdiFileDownloadOutline,
    mdiCloudDownloadOutline,
    mdiFormatListBulleted,
    mdiLabel,
    mdiLabelOutline,
    mdiNotificationClearAll,
    mdiProgressWrench,
} from '@mdi/js'

Vue.use(VueRouter);
Vue.use(VueResource);
Vue.use(VueLocalStorage);
Vue.use(Vuetify);

import App from './App.vue';
import Search from './Search.vue';
import Queue from './Queue.vue';
import Queries from './Queries.vue';

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
        Vue.prototype.$ELECTRON = __ELECTRON__;
        Vue.prototype.$MDI = {
            History: mdiHistory,
            ChevronLeft: mdiChevronLeft,
            ChevronRight: mdiChevronRight,
            ClockOutline: mdiClockOutline,
            AlertCircleOutline: mdiAlertCircleOutline,
            HelpCircleOutline: mdiHelpCircleOutline,
            Magnify: mdiMagnify,
            Tune: mdiTune,
            Dns: mdiDns,
            ReorderHorizontal: mdiReorderHorizontal,
            Delete: mdiDelete,
            FileDownloadOutline: mdiFileDownloadOutline,
            CloudDownloadOutline: mdiCloudDownloadOutline,
            FormatListBulleted: mdiFormatListBulleted,
            Label: mdiLabel,
            LabelOutline: mdiLabelOutline,
            NotificationClearAll: mdiNotificationClearAll,
            ProgressWrench: mdiProgressWrench,
        };
        if (__ELECTRON__) {
            const remote = require('electron').remote;
            Vue.prototype.__OS__ = remote.app.os;
            Vue.prototype.mmseqsVersion = remote.app.mmseqsVersion;
            Vue.prototype.saveResult = remote.app.saveResult;
            Vue.prototype.handleTitleBarDoubleClick = remote.app.handleTitleBarDoubleClick;
            Vue.prototype.newDatabase = remote.app.newDatabase;
        } else {
            Vue.prototype.__OS__ = { arch: 'web', platform: 'web' };
            Vue.prototype.mmseqsVersion = "web";
            Vue.prototype.saveResult = () => {};
        }
    }
});

if (__ELECTRON__) {
    const remote = require('electron').remote;
    Vue.url.options.root = remote.app.apiEndpoint;
    if (remote.app.token && remote.app.token.length > 0) {
        Vue.http.interceptors.push(function (request) {
            request.headers.set('Authorization', `Basic ${remote.app.token}`);
        });
    }
} else {
    Vue.url.options.root = __CONFIG__.apiEndpoint;
}

const app = new Vue({
    el: '#app',
    router,
    vuetify,
    render: h => h(App)
});


// make sure our CSS is load last
import './assets/style.css';