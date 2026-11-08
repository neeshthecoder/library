// Sets the day/night theme before first paint (see src/theme.ts for the rules).
// A manual override (the secret period toggle) wins; otherwise day is
// 07:00–18:59 local time.
(function () {
  var t = null
  try { t = localStorage.getItem('theme-override') } catch (e) { /* ignore */ }
  if (t !== 'day' && t !== 'night') {
    var h = new Date().getHours()
    t = h >= 7 && h < 19 ? 'day' : 'night'
  }
  document.documentElement.setAttribute('data-theme', t)
})()
