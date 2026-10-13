# Lens Studio design system

The interface uses a graphite shell, a bright working surface and a transaction inspector next to recent activity. The same visual system applies to all seven pages. The previous component stylesheet remains the functional baseline; `studio.css` owns the visual overrides and responsive shell.

## Tokens

- Graphite shell: `#202128`.
- Light canvas: `#f8f8fa`; white panels: `#ffffff`.
- Ink: `#22232b`; secondary text: `#676873`.
- Violet accent: `#7860ad`; positive: `#247553`.
- Dark panels: `#1d1e25`; dark text: `#eeeef3`.
- System sans-serif typography, tabular numeric columns, consistent 1.6px outline icons.

## Interaction

Select a recent activity with a click, Enter or Space to inspect it beside the timeline. Close the inspector to restore a quiet selection state. Open Labels & full details for notes, manual contact labels, available request refresh and explorer links. Unknown values remain unknown. The displayed source does not establish the sender's identity.

The overview's wallet, cash flow and agent sections remain available in its expandable section. Every page retains the existing filters, exports, source-coverage details and official PayBox handoffs. Privacy projection applies before rendering the inspector. Reduced-motion preference disables decorative transitions. Focus outlines remain visible. On narrow screens the inspector appears below the ledger and tables scroll within their own containers.

## Artwork provenance

`studio-atmosphere.jpg` is an original image generated with the built-in image generation tool, then encoded as JPEG. Its prompt was: a premium abstract wide background, smoked graphite glass prism at the far right, softly refracted amethyst at the far left, 80 percent empty charcoal center, restrained industrial optical material, no text/logo/numbers/UI/people. It is decorative, outside the data surface.

SOL, ETH, USDC, USDT and Base SVG badges are locally authored schematic identification artwork. They are not downloaded token metadata and do not verify a token's contract or authenticity. Unknown symbols use a safe one-letter badge. The supplied PayBox logo is retained. All assets are served locally; no remote image requests are added.

## Boundaries

Do not fill missing prices, identity evidence, history pages or fees with invented values. Demo captures contain fictional data and say so. Private mode masks display; it does not encrypt browser localStorage. The local server's encrypted database and its read-only bridge keep their existing behavior.
