import Vue from 'vue';
import VueRouter from 'vue-router';
import VueResource from 'vue-resource';

Vue.use(VueRouter);
Vue.use(VueResource);

Vue.http.options.root = 'http://localhost:8080'

import App from './App.vue';
import Search from './Search.vue';
import SearchResult from './SearchResult.vue';

const router = new VueRouter({
    mode: 'history',
    routes : [
        { path: '/', component: Search },
        { name : 'search-result', path: '/search/:ticket', component: SearchResult }
    ],
    linkActiveClass : 'active'
});

const app = new Vue({
    el: '#app',
    router,
    render: h => h(App)
})
