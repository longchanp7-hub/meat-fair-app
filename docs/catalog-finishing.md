# Course, signature-menu and drink catalog

## Scope
This extension keeps the existing fair collector, semantic gallery and PWA identity. It removes public fair-count badges while preserving the four status tabs and one card per brand. Normal courses, signature dishes and drink plans are separate from fairs. The fifteen brands retain their existing order.

## Sources and accuracy
`update-catalog.mjs` discovers official links and uses source-specific DOM adapters in `catalog-profiles.mjs`. Adapters describe content, never coordinates or fixed prices. Every photo URL is read from an actual official HTML image element. The rendered gallery remains shared and adaptive.

Prices require explicit tax-inclusive evidence. Image-only course boards remain official images, with unknown numeric prices. Base courses and drink add-ons are separated. Normal Amiyakitei and Plus have separate comparison scopes. A soft-drink fee must not replace an image-only alcohol plan. High-priced ingredients do not automatically imply exclusivity; the course association must come from official page context.

The Kushiya September campaign's publication date is not its start date. Its reviewed campaign dates and net-booking conditions remain in the fair dataset. Booking-only conditions are highlighted in the UI.

## Lifetime and update contract
The daily 09:00 JST job runs fairs, gallery, then catalog, and verifies generation references before publication. A catalog record carries source URL/hash, evidence/hash, actual verification time and optional fair parent/hash. A parent-linked entry is shown only with its active, matching parent and generation. Independent normal menus survive unrelated fair changes. Fetch failures retain previous confirmed entries for at most 48 hours without advancing their verification time. Normal source removal does not invent a fair end date.

The installed app checks on foreground return and every five minutes. Mixed gallery generations are not joined. Bounded independent catalog data may be shown as previously confirmed; stale fair children are not retained.

## UI and regression checks
The existing generic image planner handles fair and catalog images, natural ratios, caption measurements, image failure, text-size changes and live Fold resizing. Tiny navigation artwork is not enlarged into a content tile. Courses and drinks have readable HTML price tiles in addition to official boards when needed. Unknown availability is explicitly unconfirmed, not a claim that no plan exists.

Regression tests cover explicit tax, age/time/store/sub-brand separation, zero/free included drinks, image-only/NFD filenames, invalid URLs, lifetime, parent hashes, generation mismatch, all fifteen sections and removed count badges. The existing 0–40 image tests, six-width real browser tests, 125–200% text, filters/tabs, live growth, refresh and PWA scope tests remain.

## PWA protection
`manifest.webmanifest`, `install.js`, `sw.js` and icons are unchanged. No cross-app cache deletion, identity replacement or scope change is introduced. A Chromium browser test is not a physical Android WebAPK installation test.

## Known source limitations
Some menus are image-only, JavaScript-driven or inaccessible from the collector. Numeric prices are not inferred from filenames or untaxed amounts. Official images and source links are used where available; otherwise the UI marks information unconfirmed. The collector is bounded to eighteen HTML pages per brand per run. Dynamic website changes may require an extraction adapter update, but never brand-specific gallery CSS.
