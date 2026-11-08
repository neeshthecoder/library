// Sets the day/night theme before first paint (see src/theme.ts for the rules).
// Day is 07:00–18:59 local time.
(function () {
  var h = new Date().getHours()
  document.documentElement.setAttribute('data-theme', h >= 7 && h < 19 ? 'day' : 'night')
})()
