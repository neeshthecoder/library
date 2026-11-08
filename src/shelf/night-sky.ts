/**
 * A small crescent moon and a few stars, drawn in a 1000×100 box stretched
 * across the top of the page. Elements are placed with percentages so they
 * spread out on wide screens and stay clear of the centered headline.
 */
const star = (x: number, y: number, r: number, o: number) =>
  `<svg x="${x}%" y="${y}%" overflow="visible"><path transform="scale(${r})" d="M0,-1 Q0.18,-0.18 1,0 Q0.18,0.18 0,1 Q-0.18,0.18 -1,0 Q-0.18,-0.18 0,-1Z" fill="var(--ink)" opacity="${o}"/></svg>`
const dot = (x: number, y: number, r: number, o: number) =>
  `<circle cx="${x}%" cy="${y}%" r="${r}" fill="var(--ink)" opacity="${o}"/>`

export const NIGHT_SKY =
  '<svg focusable="false">' +
  // crescent moon (top right)
  '<svg x="86%" y="35%" overflow="visible"><path d="M0,-14 A14,14 0 1,0 12,7 A11,11 0 1,1 0,-14Z" fill="var(--ink)" opacity="0.95"/></svg>' +
  star(9, 40, 6, 0.9) +
  star(23, 70, 4, 0.7) +
  star(72, 62, 4.5, 0.75) +
  star(95, 75, 3.5, 0.6) +
  dot(15, 85, 1.5, 0.6) +
  dot(33, 35, 1.2, 0.5) +
  dot(64, 30, 1.4, 0.55) +
  dot(79, 88, 1.2, 0.5) +
  '</svg>'
