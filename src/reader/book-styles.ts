import { TOKENS } from '../styles/tokens'

/**
 * Styles injected into book content. Book content keeps the publisher's
 * typography (a documented exemption); we only set page and ink colors and
 * sane defaults for books without their own CSS.
 */
export const BOOK_CONTENT_CSS = `
  @namespace epub "http://www.idpf.org/2007/ops";
  html {
    color-scheme: light;
    background: ${TOKENS.onDark};
    color: ${TOKENS.ink};
  }
  body { background: transparent; }
  p, li, blockquote, dd { line-height: 1.5; hanging-punctuation: allow-end last; widows: 2; }
  a:any-link { color: ${TOKENS.navy}; }
  img, svg { max-width: 100%; height: auto; object-fit: contain; }
  pre { white-space: pre-wrap !important; }
  aside[epub|type~="footnote"] { display: none; }
`
