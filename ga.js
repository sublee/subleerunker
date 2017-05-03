(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
ga('create', 'UA-1078484-7', 'auto');
ga('send', 'pageview');
$(window).on('score', function(e, score, debug) {
  var section = Math.floor(score / 10) * 10;
  var label = section + '~' + (section + 9);
  if (debug) {
    label += ' (debug)';
  }
  ga('send', {
    hitType: 'event',
    eventCategory: 'Game',
    eventAction: 'score',
    eventLabel: label,
    eventValue: score
  });
});
