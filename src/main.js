require('./assets/uniclust.less');

import Vue from 'vue';
import VueRouter from 'vue-router';
import VueResource from 'vue-resource';
import VueLocalStorage from 'vue-localstorage/dist/vue-local-storage.es2015.js';

Vue.use(VueRouter);
Vue.use(VueResource);
Vue.use(VueLocalStorage)

Vue.url.options.root = 'https://search.mmseqs.com';

import App from './App.vue';
import Search from './Search.vue';
import Queue from './Queue.vue';
import Result from './Result.vue';
import TicketHistory from './History.vue';

const router = new VueRouter({
    mode: 'history',
    routes: [
        { path: '/', component: Search },
        { name: 'queue', path: '/queue/:ticket', component: Queue },
        { name: 'result', path: '/result/:ticket/:entry', component: Result },
        { name: 'history', path: '/history', component: TicketHistory }
    ],
    linkActiveClass: 'active'
});

const app = new Vue({
    el: '#app',
    router,
    render: h => h(App)
})
