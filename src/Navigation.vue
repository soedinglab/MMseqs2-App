<template>
    <navbar placement="top"
            type="default">

        <router-link slot="brand"
           to="/"
           title="Home"
           class="navbar-brand">
            <object type="image/svg+xml"
                    data="./assets/marv1.svg"
                    aria-hidden="true">
                <img src="./assets/marv1.png" />
            </object>
            <span>MMseqs Search Server</span>
        </router-link>
    
        <router-link slot="left"
                     to="/"
                     tag="li"
                     exact><a>Search</a></router-link>
        <router-link slot="left"
                     to="/history"
                     tag="li"
                     exact><a>History</a></router-link>

        <li slot="right"><a rel="external noopener" target="_blank" href="https://mmseqs.com" class="text-muted">MMseqs2</a></li>
        <li slot="right"><a rel="external noopener" target="_blank" href="https://github.com/soedinglab/mmseqs-webserver" class="text-muted">Github</a></li>
        <li slot="right"><a rel="external noopener" target="_blank" href="http://www.mpibpc.mpg.de/soeding">Södinglab</a></li>
    </navbar>
</template>

<script>
import Navbar from 'vue-strap/Navbar.vue';

export default {
    components: { Navbar }
}
</script>

<style>
.navbar-brand {
        width: 310px;
}
#app .navbar .nav {
    padding-left: 15px;
}
</style>
