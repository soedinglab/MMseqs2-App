function colors(s) {
  return s.match(/.{6}/g).map(function(x) {
    return "#" + x;
  });
}
const schemeColor20 = colors("1f77b4aec7e8ff7f0effbb782ca02c98df8ad62728ff98969467bdc5b0d58c564bc49c94e377c2f7b6d27f7f7fc7c7c7bcbd22dbdb8d17becf9edae5");

export default function scaleColor20() {
    var index = [];
    var idx = 1;
    return function(d) {
        var key = d + "";
        var i = index[key];
        if (!i) {
        i = index[key] = idx++;
        }
        return schemeColor20[(i - 1) % schemeColor20.length];
    }
}