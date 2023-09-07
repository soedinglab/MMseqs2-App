import Vue from 'vue';
import VueRouter from 'vue-router';
import Vuetify from 'vuetify/lib';
import { create } from 'axios';
import Portal from './lib/vue-simple-portal';

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
    mdiRestore,
    mdiFullscreen,
    mdiArrowRightCircle,
    mdiArrowRightCircleOutline,
    mdiCircle,
    mdiCircleHalf,
    mdiPlusBox,
    mdiMinusBox,
    mdiUpload,
    mdiFileOutline,
    mdiFileUploadOutline,
    mdiTableLarge
} from '@mdi/js'

const mdiApplicationBracesOutline = `M21 2H3C1.9 2 1 2.9 1 4V20C1 21.1 1.9 22 3 22H21C22.1 22 23 21.1 23 20V4C23 2.9 22.1 2 21 2M21 20H3V6H21V20M9 8C7.9 8 7 8.9 7 10C7 11.1 6.1 12 5 12V14C6.1 14 7 14.9 7 16C7 17.1 7.9 18 9 18H11V16H9V15C9 13.9 8.1 13 7 13C8.1 13 9 12.1 9 11V10H11V8M15 8C16.1 8 17 8.9 17 10C17 11.1 17.9 12 19 12V14C17.9 14 17 14.9 17 16C17 17.1 16.1 18 15 18H13V16H15V15C15 13.9 15.9 13 17 13C15.9 13 15 12.1 15 11V10H13V8H15Z`

Vue.use(Vuetify);
Vue.use(Portal);

import App from './App.vue';
import Search from './Search.vue';
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
            FileUploadOutline: mdiFileUploadOutline,
            CloudDownloadOutline: mdiCloudDownloadOutline,
            FormatListBulleted: mdiFormatListBulleted,
            Label: mdiLabel,
            LabelOutline: mdiLabelOutline,
            NotificationClearAll: mdiNotificationClearAll,
            ProgressWrench: mdiProgressWrench,
            Restore: mdiRestore,
            Fullscreen: mdiFullscreen,
            ArrowRightCircle: mdiArrowRightCircle,
            ArrowRightCircleOutline: mdiArrowRightCircleOutline,
            Circle: mdiCircle,
            CircleHalf: mdiCircleHalf,
            PlusBox: mdiPlusBox,
            MinusBox: mdiMinusBox,
            Upload: mdiUpload,
            FileOutline: mdiFileOutline,
            TableLarge: mdiTableLarge,
            ApplicationBracesOutline: mdiApplicationBracesOutline,
        };
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