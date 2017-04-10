<template>
    <navbar placement="top"
            type="default">

        <a slot="brand"
           href="/"
           title="Home"
           class="navbar-brand">
            <object type="image/svg+xml"
                    data="./assets/marv1.svg"
                    aria-hidden="true">
                <img src="./assets/marv1.png" />
            </object>
            <span>MMseqs Search Server</span>
        </a>
    
        <router-link slot="left"
                     to="/"
                     tag="li"
                     exact><a>Search</a></router-link>
    </navbar>
</template>

<script>
import navbar from '../node_modules/vue-strap/src/Navbar.vue';

export default {
    components: { navbar }
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
