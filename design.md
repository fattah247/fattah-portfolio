# Fattah Portfolio Design Contract

## Product idea

This portfolio is a believable personal computing environment that happens to be an excellent engineering portfolio. It is not a conventional landing page with operating-system decoration, and it never pretends to be the owner's real machine. The environment is the navigation model: visitors open applications, inspect failure cases, change one condition, compare the resulting state, and open the evidence that supports the explanation. Desktop reads as a workstation, tablet as a personal work surface, phone as a personal device; all three are one shared environment with one set of applications and one session.

The interface serves two audiences at once:

- Recruiters should understand Muhammad A. Fattah, his current scope, and his strongest projects within the first screen.
- Engineers should be able to inspect context, replay behavior, decisions, limitations, source code, and public evidence without invented claims.

## Identity that must remain

- Muhammad A. Fattah is presented as a software engineer working on Android POS and merchant payment systems.
- The portfolio focuses on reliability, observability, secure clients, and failure behavior outside the happy path.
- Projects are explained through a payment journal, forensic comparison, and causal system projection.
- IBM Plex Sans is the reading face. IBM Plex Mono is used for state, sequence, identifiers, evidence, and system feedback.
- The world is a retro personal computer: solid colours, one- and two-pixel borders, bevels, hard offset shadows, square corners, solid title bars, and pressed states that move one pixel or go inset. It is subtly cute and gender-neutral through the pixel icon family and the stepped wallpaper, never through decoration. There is no glass, blur, gradient, glow, or soft shadow anywhere.
- Steel blue (`#536fa3`) is the environment's own light: focus, selection, the running and focused app, primary actions, and the current chapter. The active title bar is `#455d83`. Sea green (`#5e9990`) is a secondary shell accent only. The warm palette and the earlier periwinkle glass identity are retired.
- Inside documents, instrument colours keep their meaning: designed blue for the intentional path, teal for verified or healthy, amber for uncertain or degraded, red for failure, adverse state, and the close control's hover.
- Window chrome is functional application UI. Do not add fake browser, IDE, terminal, or phone chrome, fake system features (Wi-Fi, battery, calculators), or fake data. The clock shows the visitor's own local time and offset.

## Information hierarchy

The order of attention is always:

1. System state and current application
2. Application title and window controls
3. Current document or chapter
4. Primary decision, outcome, or evidence
5. Supporting explanation
6. Secondary actions and references

Labels are used only when they communicate sequence, state, ownership, or evidence. Ordinary sections use ordinary headings. A large heading may establish identity, but it must not make the next useful action disappear from the first viewport.

## Applications and ownership

- **Projects** owns the portfolio front page, project index, project details, and evidence ledger.
- **Experience** owns the recruiter/engineering brief, CV download, scope, and operating principles.
- **Contact** owns email, LinkedIn, WhatsApp, and GitHub actions.
- **Product Links** is a first-class searchable directory application. Its direct route remains indexable, but launching it from the workspace creates one normal running-app session.
- Attached evidence opens as a child surface of the selected Projects case and returns focus to that case when closed.
- Desktop and tablet expose one global application launcher only: the bottom taskbar or tablet shelf. The top system bar is status-only and displays the active application; it never repeats application launch controls.
- Any internal link whose destination belongs to Projects, Experience, Contact, or Product Links opens or focuses that existing application session instead of rendering a second navigation surface or duplicate window.

The Projects application has one internal history: index → complete case → evidence child. Existing legacy summary links remain compatible, but the summary is not a mandatory stop. Cases and repository previews replace the document inside the same Projects window; they never create another taskbar item. Back restores the project index and useful scroll position. A directly loaded case route uses the Projects-owned route host while preserving the same chapter and evidence behavior.

## Window behavior

Every application uses the same states: closed, opening, active, inactive, minimized, snapped, resizing, and restored.

### Desktop

- Up to two foreground windows may be visible.
- The desktop itself is a usable workbench of applications, selected projects, and real evidence shortcuts; Home reveals it without closing running applications.
- Windows can be focused, moved, resized from every edge and corner, snapped, minimized, restored, and closed.
- A window remains within the usable viewport and its controls cannot be dragged out of reach.
- When a snapped partner closes, the remaining active window restores to the standard centered size.
- Opening an application that already exists focuses or restores it instead of creating a duplicate.
- Every open top-level application has exactly one running-app identity. Taskbar focus never creates a second identity for a child document or internal route.
- Both usable foreground windows remain opaque. Focus is communicated by the solid active title colour, a deeper hard shadow, and the pressed taskbar button; inactive windows keep a grey title bar and readable content.
- Shortcuts follow desktop convention: one click selects (the icon darkens and the label inverts to white on the accent), a double click opens, Enter or assistive activation opens, and a touch tap opens. Arrow keys move between shortcuts; clicking empty desktop clears the selection.
- Snapping follows the pointer to a screen edge: left and right tile halves, the top bar fills the workspace. There is no bottom target. Dragging a snapped or maximized window restores its previous size under the pointer.
- The desktop is a workstation: an "About this computer" desk accessory (the window chrome's inactive title strip, no controls because it is pinned; name, role, focus, Download CV, the email address), the four app icons beneath it, and the three cases as case files with their schematics printed on them down the right edge. The panel does not repeat the app icons as buttons. Icons and files drag 1:1 with the pointer, their positions persist for the session, and they are clamped back inside the desktop whenever the viewport changes. Default rows are measured in rem so a larger text setting moves the icons below the taller panel instead of under it.
- Title bars are 36px and read left to right: the app's own 16px icon (it opens the window menu: Restore, Move and Resize with arrow keys, Snap left/right, Reset position, Minimize, Maximize, Close), one breadcrumb line ("Projects / Payment reliability"), the document's compact actions ("‹ All projects"), then minimize, maximize, and close grouped at the trailing edge with close set one step apart. Controls are 20px bevelled squares in 24–28px hit areas; pressing sets them inset, and only close turns red, on hover or focus. Double-clicking the title toggles maximize.
- Apps open at sizes that suit their content, not near full screen, in a light cascade so the desktop stays visible: Projects 1180 × 780, Experience 980 × 760, Product Links 820 × 660, Contact 520 × 500 (each clamped to the workspace). Minimum widths: Projects and Product Links 420px, Experience 460px.
- Attached evidence on a desktop is a child window over its case: the case stays visible behind it with an inactive title bar, and a click outside the sheet dismisses it. Tablet and phone keep a solid stage behind the sheet.
- The wallpaper is a static pixel landscape on a 4-unit grid: two slate volcanoes lit from the upper left behind two sage terraced rice hills (the terraces keep the cases' state transitions as landscape), a far ridge, and a few cumulus clouds, every fill solid. Its darkest tone keeps ink labels above 4.5:1 wherever a shortcut is dropped. There is no pulse, grain, parallax, or scroll linkage, and it is anchored to the bottom so any aspect ratio crops sky first; the central strip a phone shows is composed to stand on its own.
- The taskbar spans the bottom edge at 40px and never scrolls: Show desktop, one button per app, and the overview. Every label is full ink (a greyed label would read as disabled). A button that is not running is flat; running is raised; focused is pressed in and bold. A 6px square marks state: filled when running, hollow when minimized, accent when focused. Minimize shrinks the window into its own taskbar button; restore grows it back out.

### Tablet

A tablet is a personal work surface, not a small desktop.

- **Shelf = launcher.** One full-width solid bar (68px) in three groups divided by a bevelled rule: Back and Home; the four apps; Recents and, when eligible, Side by side. Every button shows a 32px icon over its name (a whole multiple of the icon grid). Running apps are raised, the foreground app is pressed in, and a 6px square marks state as on the taskbar. Back rests disabled on Home, where there is nothing behind it. The shelf never scrolls.
- **Home is a board of widgets,** top-aligned like a tablet home screen, with the wallpaper's terraces below. It does not repeat the four apps (the shelf has them): identity (name, role, focus, CV, Contact), Continue when something is running, the three cases with their covers, and the role history from the same content as Experience. The cases are rows (schematic beside title and consequence) in both orientations, never three tiles. Portrait stacks the widgets; landscape puts identity, Continue, and role history on the left and the cases on the right. Shorter stages drop case summaries and the focus line, then covers and role history; the case list leaves only when it cannot fit. Home never scrolls.
- **The status bar always shows the date and time;** Home has no separate clock line.
- **Apps fill the stage** between the status bar and the shelf: no window margin, border, shadow, or close box (apps close from Recents). The title bar names the document. Below an app's root it carries a labelled Back to the parent ("‹ Projects"), which replaces the in-window "All projects"; the shelf keeps the system Back. Child sheets such as attached evidence keep their own close control.
- **Recents** shows every running app at once as a 2 × 2 board of window thumbnails sized to the screen; each thumbnail is composed for its cell, and the shelf's Recents button toggles it.
- **Side by side:** landscape starts with one foreground application. Pairing is explicit through the labelled "Side by side" control and requires a usable stage of at least 1040 × 600px with both panes at least 480px wide. The panes meet at the middle on one ink divider; the focused pane has the active title colour. Rotation keeps every session; portrait falls back to one foreground application.
- Short documents (Contact) sit in a centred reading column; a document header stacks its facts under its title rather than wrapping them beside it.
- Chapter navigation may scroll horizontally, but must show that more content exists.

### Phone

- One full-screen application is visible at a time. Each app is closed, running in the background, or in the foreground, with one running instance at most; Home backgrounds the foreground app and never resets it. There is no separate minimize on a phone.
- Home is one fixed screen that passes the 15-second test: an identity panel with CV and Contact, one cases panel with three numbered rows (no thumbnails at a size that cannot be read; each row adds its consequence line when Home is at least 44rem tall), a Continue action only when something is running, and the four-app launcher tray anchored above the system bar. It never scrolls; see Home geometry below.
- Back, Home, and Recents are system-level navigation. Back goes up one level: Recents → the app beneath it; evidence → its case; a case or repository → the Projects index; an app root → Home (the app keeps running). Back rests disabled on Home. App bars show a Back control only below an app's root; at the root, the app's name is the title.
- **History mirrors the hierarchy.** On a phone the browser's Back and the system back gesture are the same Back, so every level above Home is a real history entry: Home → app root (`/#selected-work`, `/brief`, `/products`, `/#contact`) → document (`/case/…`, `/projects/…`) → attached evidence (the case's address with its own entry). Opening a level pushes; a sibling replaces (the next case, another app chosen in Recents or by an in-app link, which therefore returns Home rather than to the app that linked it); Home and Back walk back to the shared parent, so Forward re-enters. A direct link or a refresh gets its parents written beneath it, so Back from a deep link reaches its Projects index and then Home instead of leaving the portfolio. Components still describe their documents, but on a phone only refinements of the visible document (conditions query, chapter hash) are written by them; `lib/workspace-navigation.ts` owns the stack, and desktop and tablet keep document-level history.
- Case chapters are a segmented control. Total fixed chrome stays near 176px in portrait; in landscape the status bar steps aside.
- Recents is a carousel ordered oldest to newest that opens on the newest card with the previous one peeking; it is the one shell surface allowed to page sideways. Each card is a window thumbnail as tall as the screen allows, with a solid title strip and a live snapshot of its document (the open case's cover, title, and consequence; the case list; the role list; the contact channels; the catalogue's query and matching products), its state, and a close action. Closing a card keeps Recents open on the rest; closing the last one shows the empty state. Choosing a card restores that app exactly where it was left.
- Attached evidence reads as one column: what to verify, the screenshot at its own proportions, then its source. In landscape the account sits beside a screenshot fitted to the height.
- Contact's channel rows are single targets; the arrow still marks a new tab.
- Desktop drag and resize handles are not exposed.
- Application chrome stays attached to the top of its own scrolling region.
- Safe-area insets are respected and no primary action wraps or leaves the viewport.

## Case reading order

A case reads as a complete account before it asks for interaction, on every device: **Story** (case position "Case n of 3", the failure as the title, why it matters, the schematic, what happened, the decision), **Result** (the story's outcome with and without the decision, and its limits), **Try it** (the simulator), **Evidence**, then the next case. The DOM follows this order; no stylesheet reorders case sections (a legacy flex `order` once put the simulator above the title on phones, and a contract test now forbids it). The Result chapter reports the story's own conditions; the simulator reports whatever the visitor sets.

The Projects index opens like a document: its title, then a short abstract beneath it (no split hero, no oversized top band). The three cases are case files, the same objects as on the desktop: uniform rows with a folder tab, an ink border, and a hard shadow, the schematic printed beside the account from 40rem up. There is no featured card and no card grid. On a narrow container (a phone or a narrow window) the title shrinks, the abstract keeps only its first sentence, and the files drop their schematics and fit the first screen together, each ending in a line that pairs the stack with "Open case"; schematics appear inside the case, where they are explained, never shrunk past reading. Narrow evidence is a list of rows with a small preview; the screenshot is read in the evidence viewer.

In the story, the decision is marked once with the designed path's lamp (a 10px square beside "Decision"); the Result's two paths carry red and blue lamps beside their labels. Meaning colour is never a side stripe.

## Case instruments

Each case's "Try it" is an instrument built from one deterministic model in `lib/instruments.ts`, which derives its outcomes from `projectScenario` and is tested against it for every condition combination.

- Each instrument is one piece of lab equipment: a raised object with a nameplate strip (the "About this computer" title strip) carrying "Test the decision", the instrument's name in mono (Callback replay, Latency monitor, Policy evaluator), and "Simulated". Below it, one instruction line that says it starts at the story's conditions.
- Inputs live in one panel: Approach first, then the condition groups. Each group is a set of selector keys joined into one object: two options sit side by side as a switch, three stack as a short column. The pressed key is set in, tinted, and its marker filled. When a group leaves the story's setting, the key it left shows "story", and Reset conditions appears.
- The display is set into the instrument like a screen (ink border, inset edge). The readout beside or below it gives the result with a lamp in its meaning colour, the other approach's result, what changed, and each part's state. Nothing uses a coloured side stripe.
- Cause and effect: whatever changed in the last update (a state value, a cell, a policy rule, the decision, the result) is outlined in the accent and steps back out once; a payment step that has just arrived is lit and settles. Values never depend on the mark, and reduced motion leaves it out. Keys are 34px on a desktop and 44px in touch modes.
- Narrow instruments read as one path: Approach, the primary condition, the view, the result. Secondary conditions fold behind "More conditions" (counting any that differ from the story, and starting open when one does) and the per-part state behind "State of each part". Wide instruments show everything and hide the toggles.
- Payment: one display in three bands. The transport first (Run sequence with a play mark, Step, Rewind, and the run's readout), then the event sequence as numbered rows (delivery, event ID and sequence, the check, a decision lamp and label, the state transition), then the output band: "Payment state" lamps (never button-shaped; the current state lit in its meaning colour) and the counts of deliveries and state changes. A recessed readout shows a lamp, the state, and "n of N": Ready (rewound, hollow lamp), Running (accent), Paused part-way (amber), Completed (green). Run sequence becomes Pause while running and Resume when paused; Step advances one event; Rewind returns to Ready. A run pauses where it is when the case leaves the screen (Home, Recents, another app, evidence over it, a hidden tab) and waits for Resume. While new conditions are being applied the controls are disabled. A condition change shows the new run complete.
- Observability: the actual latency (dashed) against what monitoring observed (solid), a 500 ms threshold, and rows for observed P95, health, and the latency alert. A missing sample reads "No sample" and "No data", never zero or quiet.
- Device trust: signals, assessment, an ordered policy where the first matching rule decides (matched, not met, not reached), and the decision.
- Layout follows the instrument's width: compact stacks the primary control, view, other controls, and inspector; medium puts controls beside the view; wide adds the inspector as a third column. Inputs, approach, and results live above the view, so resizing, rotation, or a device-mode change never resets a run.

## Device capabilities and document composition

Two responsibilities stay separate. The device classifier decides application behavior: phone (width ≤ 600px, or a landscape touch-first screen with a coarse primary pointer, no hover, height ≤ 500px and width ≤ 960px) shows one full-screen application; tablet (remaining widths ≤ 1100px, or any larger touch-first screen without hover) shows a constrained touch stage; everything else is a desktop with movable, resizable windows. Height alone never makes a desktop a phone, and a touchscreen laptop with a fine pointer stays a desktop. The width of the application container decides how a document composes. Named containers (`selected-work`, `projects-app`, `github-project-window`, `github-project-index`, `causal-stage`, `experience-brief`, `product-directory`) switch at 42rem and 64rem (the Projects index also uses 40rem, 52rem, and 72rem bands for its case files); gutters run 16–24px, 24–40px, and up to 64px by band; documents stop growing at 88rem and center beyond it.

- Below 42rem: full-width title, brief beneath it, linear story, compact diagrams, vertical Baseline / Designed / Why, one evidence column.
- 42–64rem: full-width title and consequence, balanced brief cells, Baseline and Designed side by side with Why below, two evidence columns where usable.
- Above 64rem: brief/thesis split, controls/visualization split, three comparison columns, evidence introduction beside the evidence.

## Home geometry and scroll layers

Home is a screen, not a page. Three layers own scrolling:

- **Shell** (status bar, wallpaper, Home, taskbar, shelf, phone bar): never scrolls. `html[data-system-mode]` and `body` are `overflow: clip` with `overscroll-behavior: none`; no system bar has `overflow: auto`.
- **Application frame** (window chrome, chapter tabs): fixed within its window.
- **Document**: the one scroll owner inside each window, contained so scrolling never chains into Home.

The Home screen sits exactly between the status bar and the system bar (`inset` from the bar variables, safe areas included) and is a size container (`container: home / size`). Its layout fills it with a grid whose spacer row absorbs spare height, so the launcher stays anchored above the system bar. Compositions change with the container's real size, in rem so that text size counts:

- ≤ 43.75rem tall: case covers and the focus line drop; case rows become title rows.
- ≤ 33.75rem: the clock and case categories drop.
- ≤ 27rem, or ≤ 19rem wide and ≤ 37.5rem tall: the case list drops (Projects stays in the launcher).
- ≤ 19rem wide: the launcher becomes 2×2 and the identity mark drops.
- Landscape ≤ 32.5rem tall: identity on the left, launcher on the right. On a phone at least 36rem wide and 19rem tall, the three cases join the left column as title rows and Continue sits under the launcher.
- Phone ≥ 44rem tall: case rows carry their consequence line. Phone ≤ 32rem tall with Continue showing: the panels close up (targets stay 44px).

Overflow is clipped only as a last safeguard; every supported size is composed to fit. The browser audit checks root, Home, and bar `scrollHeight`/`scrollWidth`, essential rectangles against the usable area, pairwise overlap, clipped text, 44px targets, and real wheel, Shift-wheel, keyboard, focus, and touch-swipe attempts. `lib/environment-contract.test.ts` guards the stylesheet side.

The window frame is the single scroll owner of a document: it records the scroll position in the workspace record and restores it when the document, device mode, or frame changes. Hosts write records to express intent (a fresh open starts at the top; leaving the index keeps its position) and never scroll a surface imperatively. Focus and switching rewrite the current address in place; only opening a new document pushes history, and the tab title follows the route. A phone extends this so history mirrors its hierarchy (see Phone above). A chapter hash the route does not name survives focus.

## Color and material system

`app/environment.css` is the material, colour, and type authority and loads last; `app/design-tokens.css` holds the base tokens the legacy layers read.

| Role | Value |
|---|---|
| Desktop ground | `#dce3ea` |
| Surfaces | surface `#f1f3f5`, secondary `#e3e7ec`, raised `#f7f8f9`, recessed `#d3d9e1` |
| Lines | border `#8d98a7`, ink line `#252b34` |
| Ink | `#252b34`, secondary `#59616d` |
| Title bars | active `#455d83` with white text; inactive `#d3d9e1` with `#59616d` |
| Accent | `#536fa3`; deep `#3f5687`; selection `#c8d8f0`; sea green `#5e9990` (shell only) |
| Document | `#f7f8f9`, sunken `#e9edf1`, edge `#b8c1cd` |
| Instruments | designed `#3a5f9f`, verified `#3a7a6c`, uncertain `#85621f`, adverse `#b84f55` |

- Material: every surface is a solid colour. Raised controls use a one-pixel bevel (white top-left, `#8d98a7` bottom-right); pressed and recessed surfaces invert it. Primary controls are solid accent with an accent bevel. Shadows are hard offsets only (2–4px, no blur) and mark objects that sit above the desktop: windows, panels, case files.
- Radii: 0 for windows and title bars, 2px at most anywhere else.
- Buttons: one family. Secondary is raised light with an ink border; primary is solid accent with white text. Both press in by one pixel, show a 2px focus ring, and have a disabled state; touch modes keep 44px targets while the visual stays compact. No pill, gloss, or gradient button exists.
- Icon family: authored pixel art stored as pixel maps (`components/app-icons.tsx`), so every edge lands on the grid and nothing is anti-aliased. One-unit ink outline, flat fills, lit from the top left; no tile behind the object. A 32 × 32 drawing for 32–96px and a separate simplified 16 × 16 drawing for 16px (taskbar, window menus, Recents). Projects is an open folder with a sea-green tab, a thumb notch in its front cover, and a tiny state diagram on its front sheet; Experience is a clipboard carrying a CV; Contact is an envelope with a perforated stamp whose picture is the wallpaper's terraces; Product Links is a card file with tabbed index cards. Icons are shown only at whole multiples of their grid (16, 32, 48, 64, 96); the same artwork appears on the desktop (48), taskbar (16), title-bar menu (16), shelf (32), launcher (32), Continue (32), and Recents (16).

## Typography and density

- Display size is bounded by the application container, not only the viewport.
- Reading text targets 60–72 characters per line and a line-height near 1.5.
- One family, IBM Plex Sans, for every interface and reading role. IBM Plex Mono only for identifiers, times, measurements, and instrument values, with tabular numerals.
- Type tokens in environment.css: caption, label, system (chrome and launcher labels), button, body, body-strong, app heading, section, title, mono. Section and title sizes scale with the container (`cqw`), so a narrow window gets compact headings without a different system.
- Spacing follows a 4px base with 8, 12, 16, 24, 32, 48, and 64px steps.
- Rules exist to explain structure, not to fill empty space.

## Motion

- Micro response: 140ms
- Focus and controls: 180ms
- Window open: 160ms; on tablet and phone the app grows from the icon or row that opened it (280ms)
- Minimize and restore: 380ms along the vector to the taskbar button
- Causal reconstruction: 380ms
- Desktop objects follow the pointer 1:1 and drop in place
- No boot sequence: `/` opens on Home with nothing auto-launched.

Motion communicates origin, destination, focus, or causality. Documents, rows, icons, launcher items, Recents cards, and window contents do not fade up in staggered sequences; those entrance animations are switched off in environment.css's motion audit. There is no ambient motion: the wallpaper is static and nothing follows the pointer. Open animations never keep filling once finished, so state transitions can run. `prefers-reduced-motion` removes travel while keeping every state understandable.

Application entry changes with the device model: desktop uses a short focus-settle, tablet reveals the constrained stage, and phone reveals from the forward navigation edge. These transitions never delay readable content.

System information is never repeated within one view. Desktop uses the top-right clock only. Tablet shows the date and time in its status bar on every surface. Phone shows the time in its status bar on every surface, with the short date on Home; Home has no clock line. Landscape phones hide the status bar.

## Responsive constraints

- Verify 1920×1080, 1440×900, 1366×768, 1280×800, 1280×600, 1024×768, 1366×1024, 1194×834, 834×1194, 768×1024, 1024×600, 430×932, 393×852, 375×812, 360×800, 360×640, 320×568, 262–280px widths, phone landscape (852×393, 812×375, 740×360), 125% and 150% zoom (as smaller CSS viewports), and 125–130% text, plus desktop window widths from 400px to maximized, resizing, and rotation.
- Home never scrolls at any of these sizes, and every essential Home control is inside the usable area.
- Readable text never drops below 12px.
- No root or application-level horizontal overflow.
- Diagrams select compact, medium, or wide composition from their container.
- Sticky chapter targets account for both window chrome and chapter navigation height.
- Images preserve aspect ratio and stay inside their evidence surface.
- Text wraps naturally, but primary action labels do not wrap.

## Interaction and accessibility

- Every interactive element has an accessible name, visible keyboard focus, and at least a 44px touch target where space permits.
- Hover is supplementary; focus and pressed states communicate the same meaning.
- Focus returns to the invoking control when a child surface closes. When an app closes and takes focus with it, focus returns to that app's taskbar or shelf button.
- Keyboard Escape closes the foreground child surface before its parent application.
- Loading, empty, and error states live inside the owning application.
- Server-rendered essential content remains readable without waiting for motion.

## Enforced visual and writing rules

Every visual and interaction choice needs a reason tied to the work or the workspace. These rules are checked in code and tests.

- **Icons come from the shared SVG set.** Glyph characters (▶ Ⅱ ⇆ × ↗ ⋯ ← →) never stand in for icons. The up-right arrow marks only links that open a new tab; chevrons mark in-app navigation; the download icon marks files.
- **Containers represent objects.** Windows, case files, instruments, exhibits, the identity card, Home widgets, and Recents cards get a boundary. Lists, tables, timelines, and prose do not: side projects are a plain repository list, Experience is a timeline (a hairline with a square node per role, the current role filled) with a scope table, the catalogue is one grouped list, and contact channels share one list under the primary email.
- **Labels carry information.** No eyebrow over ordinary headings, no uppercase micro-labels on chrome, no badges for "Current" or counts that repeat what the layout shows. Mono is reserved for identifiers, times, and instrument values.
- **Each case reads in order without literal headings:** the failure and its constraint, the situation in prose, the decision marked once, the schematic, the replay, the result with its limits, then evidence.
- **Headings are statements, not slogans,** without a closing full stop.
- **One response per control.** Hover lightens a control; pressing moves it 1px and sets its bevel inset. Nothing reveals content that is hidden at rest, and touch never depends on hover.
- **No generated-interface tells.** No glass, frosted surfaces, backdrop blur, gradients, gloss, pills, glows, neon, blobs, blurred or decorative shadows, card-in-card layouts, generic three-column feature grids, uppercase eyebrows, or slogans. The rejected "Run sequence" look (gradient, glossy highlight, large radius, soft shadow) must not return in any colour. The contract test and the computed-style audit check these.
- **Colour has meaning.** Steel blue marks focus, selection, running and current state, and primary actions. Red is reserved for adverse states and the close control's hover; it is never a resting window ring, a file marker, or a decorative stripe. Missing telemetry is amber, never red. Meaning is carried by lamps and markers (small ink-outlined squares), never by a coloured side stripe; the contract test rejects left borders of 2px or more.
- **Schematics are labelled as schematics.** Case covers draw the shape of each problem and are captioned as not measured data.
- **No editorial scaffolding.** No eyebrow labels above ordinary headings, no window subtitles, and no lines that narrate the interface. Story markers label only Failure and Constraint, where they mark sequence.
- **The three cases are public labs.** Copy never calls them production or employer systems; simulated instrument values are labelled as simulated.
- **One place per fact.** A window title does not repeat the document's opening name; a repository with a complete case is not also a side project; a comparison uses the case's own baseline and designed labels everywhere.
- **Escape belongs to the foreground child.** A search field consumes Escape before its window, a repository preview returns to the index, and a background application never reacts.

## Evidence and content integrity

Never invent employers, metrics, outcomes, repositories, testimonials, or technical claims. Preserve scenario facts, public-demonstration labels, analytics, links, CV, and contact data. Visual refinement may change hierarchy and presentation, but not the meaning of the evidence.
