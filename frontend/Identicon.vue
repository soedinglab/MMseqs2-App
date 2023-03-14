<template>
    <img :src="'data:image/svg+xml;base64,' + makeData(hash, size)" :width="size" :height="size" />
</template>

<script>
import identicon from "./lib/identicon";

// using the ticket directly results in an ugly image
// build our own very simple non-secure 15 byte hash
function h(x){
    var A = 31;
    var h = 0;
    for (var i = 0; i < x.length; ++i){
        h = ((h*A) + x[i].charCodeAt(0));
    }
    return h.toString(16).slice(0,14) + "" + h.toString(16)[0];
}

export default {
    name: "identicon",
    props: { hash: { default: "", type: String }, size: { default: 32, type: Number } },
    methods: {
        makeData(hash, size) {
            return new identicon(h(hash), {
                background: [0, 0, 0, 0],
                margin: 0,
                size: size,
                format: "svg"
            }).toString();
        }
    }
};
</script>