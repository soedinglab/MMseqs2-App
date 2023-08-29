import Vue from 'vue';
import Vuetify from 'vuetify/lib';
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
} from '@mdi/js'

Vue.use(Vuetify);
Vue.use(Portal);

import { Shape, Stage, Selection, download, ColormakerRegistry, PdbWriter } from 'ngl';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parse, parseMatrix } from 'tmalign-wasm';

import AppLocal from './AppLocal.vue';
const appStrings = {
    mmseqs: require('./assets/mmseqs.en_US.po').default,
    foldseek: require('./assets/foldseek.en_US.po').default,
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
            Restore: mdiRestore,
            Fullscreen: mdiFullscreen,
            ArrowRightCircle: mdiArrowRightCircle,
            ArrowRightCircleOutline: mdiArrowRightCircleOutline,
            Circle: mdiCircle,
            CircleHalf: mdiCircleHalf,
            PlusBox: mdiPlusBox,
            MinusBox: mdiMinusBox,
        };
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