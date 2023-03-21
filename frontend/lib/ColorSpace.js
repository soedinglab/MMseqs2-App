// from https://github.com/d3/d3-color/blob/958249d3a17aaff499d2a9fc9a0f7b8b8e8a47c8/src/color.js#L1
// licensed under ISC
// Copyright 2010-2022 Mike Bostock

// Permission to use, copy, modify, and/or distribute this software for any purpose
// with or without fee is hereby granted, provided that the above copyright notice
// and this permission notice appear in all copies.

// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
// INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
// OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
// TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
// THIS SOFTWARE.

// function hsl2rgb(h, s, l) {
//     const toRgb = (h, m1, m2) => {
//         return (h < 60 ? m1 + (m2 - m1) * h / 60
//             : h < 180 ? m2
//             : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
//             : m1) * 255;
//     }
//     var h = h % 360 + (h < 0) * 360,
//         s = isNaN(h) || isNaN(s) ? 0 : s,
//         m2 = l + (l < 0.5 ? l : 1 - l) * s,
//         m1 = 2 * l - m2;
//     return rgb2hex(
//         toRgb(h >= 240 ? h - 240 : h + 120, m1, m2),
//         toRgb(h, m1, m2),
//         toRgb(h < 120 ? h + 240 : h - 120, m1, m2),
//     );
// }

function rgb2hsl(hex) {
    var hex = hex2rgb(hex);
    var r = hex[0],
        g = hex[1],
        b = hex[2];
    var min = Math.min(r, g, b),
        max = Math.max(r, g, b),
        h = NaN,
        s = max - min,
        l = (max + min) / 2;
    if (s) {
      if (r === max) h = (g - b) / s + (g < b) * 6;
      else if (g === max) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max + min : 2 - max - min;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return [h, s, l];
}

// end ISC

// function rgb2hex(r,g,b) {
//     const h = x => {
//         const c = Math.round(x).toString(16);
//         return c.length == 1 ? '0' + c : c;
//     };
//     return `#${h(r)}${h(g)}${h(b)}`;
// }

function hex2rgb(hex) {
    const h = x => parseInt(x, 16) / 255;
    return [h(hex.slice(1,3)), h(hex.slice(3,5)), h(hex.slice(5,7))];
}

export {
    // hsl2rgb,
    rgb2hsl,
    hex2rgb
}