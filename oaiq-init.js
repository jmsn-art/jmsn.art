// OpenAI Ads measurement pixel for jmsn.art.
(function (w, d, s, u) {
  if (w.oaiq) return;
  var q = function () { q.q.push(arguments); };
  q.q = [];
  w.oaiq = q;
  var js = d.createElement(s);
  js.async = true;
  js.src = u;
  var first = d.getElementsByTagName(s)[0];
  first.parentNode.insertBefore(js, first);
})(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");

oaiq("init", { pixelId: "WrFM8T2Vq2D6Wmyefbs6eM" });
