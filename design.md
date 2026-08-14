# Fattah Portfolio Design Contract

## Product idea

This portfolio is an interactive engineering workspace. It is not a conventional landing page with operating-system decoration. The operating system is the navigation model: visitors open applications, inspect failure cases, change one condition, compare the resulting state, and open the evidence that supports the explanation.

The interface serves two audiences at once:

- Recruiters should understand Muhammad A. Fattah, his current scope, and his strongest work within the first screen.
- Engineers should be able to inspect context, replay behavior, decisions, limitations, source code, and public evidence without invented claims.

## Identity that must remain

- Muhammad A. Fattah is presented as a software engineer working on Android POS and merchant payment systems.
- The portfolio focuses on reliability, observability, secure clients, and failure behavior outside the happy path.
- Work is explained through a payment journal, forensic comparison, and causal system projection.
- IBM Plex Sans is the reading face. IBM Plex Mono is used for state, sequence, identifiers, evidence, and system feedback.
- The resting interface is predominantly mineral paper, ink, graphite, and rules.
- Designed blue means an intentional or active designed state. Teal means verified or healthy. Amber means uncertain or degraded. Red means failure, adverse state, destructive close, or a causal fault marker.
- Window chrome is functional application UI. Do not add fake browser, IDE, terminal, or phone chrome.

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

- **Work** owns the portfolio front page, project index, selected-work details, and evidence ledger.
- **Experience** owns the recruiter/engineering brief, CV download, scope, and operating principles.
- **Contact** owns email, LinkedIn, WhatsApp, and GitHub actions.
- **Product Links** is a first-class searchable directory application. Its direct route remains indexable, but launching it from the workspace creates one normal running-app session.
- Attached evidence opens as a child surface of the selected Work case and returns focus to that case when closed.
- Desktop and tablet expose one global application launcher only: the bottom taskbar or tablet shelf. The top system bar is status-only and displays the active application; it never repeats application launch controls.
- Any internal link whose destination belongs to Work, Experience, Contact, or Product Links opens or focuses that existing application session instead of rendering a second navigation surface or duplicate window.

The Work application has one internal history: index → selected-work summary → full case → evidence child. Summary and full case replace one another inside the same Work window; they never create another taskbar item. Back restores the selected project and useful scroll position. A directly loaded case route uses the Work-owned route host while preserving the same chapter and evidence behavior.

## Window behavior

Every application uses the same states: closed, opening, active, inactive, minimized, snapped, resizing, and restored.

### Desktop

- Up to two foreground windows may be visible.
- The desktop itself is a usable workbench of applications, selected work, and real evidence shortcuts; Home reveals it without closing running applications.
- Windows can be focused, moved, resized from every edge and corner, snapped, minimized, restored, and closed.
- A window remains within the usable viewport and its controls cannot be dragged out of reach.
- When a snapped partner closes, the remaining active window restores to the standard centered size.
- Opening an application that already exists focuses or restores it instead of creating a duplicate.
- Every open top-level application has exactly one running-app identity. Taskbar focus never creates a second identity for a child document or internal route.
- Both usable foreground windows remain opaque. Focus is communicated by chrome, border, depth, and taskbar state rather than translucent content.
- The desktop evokes a compact engineering workstation: crisp document icons, raised controls, an edge-attached task strip, and evidence placed like working files. Nostalgia comes from interaction and material, never fake browser or terminal chrome.

### Tablet

- The application model remains visible, but placement is constrained and controls are touch-safe.
- Home is a touch-first stage with local time, identity, a resumable application, and the shared application launcher.
- Controls use a deliberate raised/pressed language and a constrained shelf rather than imitating floating desktop windows.
- Landscape may show a restrained split. Portrait prioritizes one foreground application.
- Chapter navigation may scroll horizontally, but must show that more content exists.

### Phone

- One full-screen application is visible at a time.
- Home behaves like a mobile launcher: local time and date, a concise identity widget, a resume action, and a four-application grid.
- Navigation follows an Android-like Back, Home, and Recents model while remaining part of the mineral-paper system.
- Back, Home, and Recents are system-level navigation.
- Recents presents portrait application cards with explicit Active, Background, and Minimized states and a close action.
- Desktop drag and resize handles are not exposed.
- Application chrome stays attached to the top of its own scrolling region.
- Safe-area insets are respected and no primary action wraps or leaves the viewport.

## Color system

At least 80% of every resting view uses neutral surfaces.

- Mineral paper: `#eef1f0`
- Raised paper: `#fbfcfa`
- Recessed paper: `#e4e8e6`
- Ink: `#101416`
- Graphite: `#566168`
- Rule: `#cbd1cf`
- Designed blue: `#155b8f`
- Verified teal: `#237368`
- Uncertain amber: `#8a5514`
- Adverse red: `#d44834`
- Adverse text: `#c23a2a` (contrast-safe on mineral and raised paper)

No gradients, glow, glassmorphism, ornamental blobs, or arbitrary per-component palettes.

## Typography and density

- Display size is bounded by the application container, not only the viewport.
- Reading text targets 60–72 characters per line and a line-height near 1.5.
- Mono labels are concise and use tabular numerals when they contain changing values.
- Spacing follows a 4px base with 8, 12, 16, 24, 32, 48, and 64px steps.
- Rules exist to explain structure, not to fill empty space.

## Motion

- Micro response: 140ms
- Focus and controls: 180ms
- Window open, restore, and snap: 240ms
- Causal reconstruction: 380ms
- Boot handoff: no more than 900ms and always skippable

Motion communicates origin, destination, focus, or causality. Resting content does not float, pulse, or repeatedly reveal itself. The close control retains its authored character: it turns adverse red and flips before the window leaves. `prefers-reduced-motion` removes travel while keeping every state understandable.

Application entry changes with the device model: desktop uses a short focus-settle, tablet reveals the constrained stage, and phone reveals from the forward navigation edge. These transitions never delay readable content.

System information is never repeated within one view. Desktop uses the top-right clock only. Tablet and phone Home use the large launcher clock and suppress the compact top-bar clock until an application is open.

## Responsive constraints

- Verify 320, 375, 414, 768, 1024, and 1440px plus intermediate resizing.
- No root or application-level horizontal overflow.
- Diagrams select compact, medium, or wide composition from their container.
- Sticky chapter targets account for both window chrome and chapter navigation height.
- Images preserve aspect ratio and stay inside their evidence surface.
- Text wraps naturally, but primary action labels do not wrap.

## Interaction and accessibility

- Every interactive element has an accessible name, visible keyboard focus, and at least a 44px touch target where space permits.
- Hover is supplementary; focus and pressed states communicate the same meaning.
- Focus returns to the invoking control when a child surface closes.
- Keyboard Escape closes the foreground child surface before its parent application.
- Loading, empty, and error states live inside the owning application.
- Server-rendered essential content remains readable without waiting for motion.

## Evidence and content integrity

Never invent employers, metrics, outcomes, repositories, testimonials, or technical claims. Preserve scenario facts, public-demonstration labels, analytics, links, CV, and contact data. Visual refinement may change hierarchy and presentation, but not the meaning of the evidence.
