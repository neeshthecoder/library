/**
 * The divider between reading and finished books: a flat, geometric take on
 * a wooden-block bookend with a pipe lamp and an Edison bulb. Flat fills and
 * overlapping translucent shapes, no gradients or shadows. Drawn in a
 * 100 × 230 box; colors come from CSS classes so the night theme can light
 * the bulb.
 */
export const BOOKEND_VIEWBOX = { w: 100, h: 230 }

export const BOOKEND_SVG = `
<svg class="bookend-art" viewBox="0 0 100 230" aria-hidden="true" focusable="false">
  <circle class="be-glow" cx="66" cy="50" r="46"/>
  <!-- base board: top face and front edge -->
  <rect class="be-wood-top" x="0" y="210" width="100" height="6" rx="2"/>
  <rect class="be-wood-edge" x="0" y="215" width="100" height="15" rx="2"/>
  <!-- the block: a darker side face and a lighter front -->
  <rect class="be-wood-edge" x="0" y="108" width="40" height="104" rx="2"/>
  <rect class="be-wood" x="6" y="108" width="34" height="104" rx="2"/>
  <rect class="be-wood-top" x="6" y="108" width="34" height="5" rx="2"/>
  <!-- wall flange on the block -->
  <circle class="be-iron-dark" cx="34" cy="160" r="13"/>
  <circle class="be-iron" cx="34" cy="160" r="8"/>
  <!-- horizontal pipe into a cross fitting -->
  <rect class="be-iron" x="34" y="154" width="26" height="12"/>
  <rect class="be-iron-dark" x="57" y="147" width="19" height="26" rx="3"/>
  <rect class="be-iron" x="75" y="154" width="9" height="12" rx="2"/>
  <!-- down to a floor flange -->
  <rect class="be-iron" x="61" y="172" width="11" height="32"/>
  <rect class="be-iron-dark" x="51" y="203" width="31" height="8" rx="3"/>
  <!-- up to the socket -->
  <rect class="be-iron" x="61" y="100" width="11" height="48"/>
  <rect class="be-iron-dark" x="55" y="84" width="23" height="18" rx="3"/>
  <!-- the bulb: translucent amber over the wall, with a filament -->
  <path class="be-bulb" d="M60,86 L60,78 C48,70 42,58 44,44 C46,26 56,16 66,16 C76,16 86,26 88,44 C90,58 84,70 72,78 L72,86 Z"/>
  <path class="be-bulb-core" d="M61,80 C55,66 58,46 66,40 C74,46 77,66 71,80 Z"/>
  <path class="be-filament" d="M63,80 L63,52 L66,46 L69,52 L69,80 M63,58 L69,62 M63,66 L69,70"/>
</svg>`
