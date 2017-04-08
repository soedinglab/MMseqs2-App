<template>
    <nav class="navbar navbar-default navbar-fixed-top">
        <div class="container">
            <div class="navbar-header">
                <a class="navbar-brand"
                   href="#">
                    <object type="image/svg+xml"
                            data="./assets/marv1.svg"
                            aria-hidden="true">
                        <img src="./assets/marv1.png" />
                    </object>
                    <span>MMseqs</span>
                </a>
                <button type="button"
                        class="navbar-toggle collapsed"
                        data-toggle="collapse"
                        data-target="#navbar"
                        aria-expanded="false"
                        aria-controls="navbar">
                    <span class="sr-only">Toggle navigation</span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                </button>
            </div>

            <div id="navbar"
                 class="collapse navbar-collapse">
                <ul class="nav navbar-nav">
                    <router-link to="/"
                                 tag="li"
                                 exact><a>Home</a></router-link>
                </ul>
            </div>
        </div>
    </nav>
</template>

<style>
#navbar > .nav {
    padding-left: 15px;
}
</style>