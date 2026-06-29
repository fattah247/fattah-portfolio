# Portfolio Blueprint — Counterfactual Debugger

Status: proposed for review  
Implementation: not started  
Working identity: **Second Attempt**

## 1. Product thesis

The portfolio demonstrates engineering judgment by letting a visitor change one system condition and compare the consequences.

> Rewind the event. Change one condition. Recompute only what depends on it. Explain the divergence.

This is not a simulated BCA system. All interactive scenarios are clearly identified as public demonstrations derived from PayFlow Reliability, iYup, and TrustGate Android.

## 2. Audience contract

The experience supports two reading depths without asking visitors to identify themselves.

- The primary layer states the problem, consequence, decision, and result in plain language.
- The inspection layer exposes state, assumptions, tradeoffs, evidence, and limitations.
- A persistent Brief control provides a conventional, printable recruiter view at any time.
- No essential information depends on completing an interaction.

## 3. Information architecture

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Cold open, identity, scenario index, and recommended first replay |
| `/case/payflow` | Duplicate callback counterfactual |
| `/case/iyup` | Degraded-service and missing-telemetry counterfactual |
| `/case/trustgate` | Device-trust policy counterfactual |
| `/brief` | Conventional overview for recruiters, printing, and reduced-complexity access |
| `/evidence` | Claim-to-evidence ledger and public repository index |

Every case route must be directly loadable, shareable, indexable, and correct without first visiting `/`.

### Persistent controls

- `M.A.F / SECOND ATTEMPT`: returns home.
- `REPLAY`: opens scenario selection.
- `BRIEF`: opens `/brief`.
- `EVIDENCE`: opens `/evidence`.
- GitHub, LinkedIn, résumé, and email remain one interaction away.

## 4. Experience flow

### Home: cold open

The visitor sees a payment event already in progress, not a traditional hero.

```text
PAYMENT 7F2A                           PUBLIC DEMONSTRATION
STATE  PROCESSING

The merchant submitted the payment again.

[ PROCESS AS NEW ]    [ MATCH EXISTING INTENT ]

[ Skip replay — read the brief ]
```

If the visitor does nothing, a restrained eight-second preview demonstrates both branches and then reveals the identity. Interaction cancels the preview.

After divergence:

```text
BASELINE                              DESIGNED
second payment path                   existing intent retained

Muhammad A. Fattah
Software engineer working on payment reliability,
secure mobile clients, and production visibility.

I design the branch on the right.
```

The identity and navigation remain visible afterward. They are never delayed for repeat visitors or visitors using reduced motion.

### Scenario selection

```text
REPLAY A FAILURE

01  The callback returned       PayFlow Reliability
02  Nothing was down            iYup
03  The signal was not a verdict TrustGate Android
```

Each entry shows one business consequence and one engineering question. Technology names remain secondary.

### Case flow

All cases use the same investigation grammar:

1. Consequence
2. Shared initial state
3. Adjustable assumption
4. Divergence
5. Downstream consequence
6. Engineering decision
7. Attached evidence
8. Limitation / next investigation
9. Repository handoff

The consistent grammar makes the unusual interface learnable.

## 5. Desktop wireframes

### Case workspace, 1280 px and above

```text
┌────────────────────────────────────────────────────────────────────┐
│ M.A.F / SECOND ATTEMPT     REPLAY     BRIEF     EVIDENCE     01/03 │
├──────────────────────┬──────────────────────┬──────────────────────┤
│ BASELINE             │ DESIGNED             │ AUDIT TAPE           │
│                      │                      │                      │
│ shared event         │ shared event         │ condition changed    │
│      │               │      │               │ decision             │
│ divergence           │ divergence           │ reasoning            │
│      │               │      │               │ evidence             │
│ consequence          │ consequence          │ limitation           │
│                      │                      │                      │
├──────────────────────┴──────────────────────┴──────────────────────┤
│ ASSUMPTIONS / REWIND / PLAY                         OPEN EVIDENCE  │
└────────────────────────────────────────────────────────────────────┘
```

Grid proportions:

- Baseline: 34%
- Designed: 34%
- Audit tape: 32%
- Header: 56–64 px
- Control rail: 72–88 px
- Maximum workspace width: 1600 px

The baseline and designed systems have equal visual authority. The audit tape is readable prose, not terminal output.

### Brief view

```text
┌────────────────────────────────────────────────────────────────────┐
│ MUHAMMAD A. FATTAH                                      RÉSUMÉ ↓  │
│ Software Engineer                                                 │
├──────────────────────────────┬─────────────────────────────────────┤
│ PROFILE                      │ SELECTED EVIDENCE                   │
│ CURRENT / LOCATION / CONTACT │ PayFlow / iYup / TrustGate          │
├──────────────────────────────┴─────────────────────────────────────┤
│ EXPERIENCE: responsibility progression                            │
├────────────────────────────────────────────────────────────────────┤
│ SYSTEM SCOPE / PRINCIPLES / PUBLIC REPOSITORIES                    │
└────────────────────────────────────────────────────────────────────┘
```

## 6. Mobile wireframes

The comparison cannot be squeezed into three columns.

```text
┌──────────────────────────┐
│ M.A.F       01/03  MENU  │
├──────────────────────────┤
│ condition / consequence  │
├──────────────────────────┤
│ [ BASELINE | DESIGNED ]  │
│                          │
│ active projection        │
│                          │
│ SHOW DIFFERENCE          │
├──────────────────────────┤
│ assumption controls      │
├──────────────────────────┤
│ audit card               │
└──────────────────────────┘
```

- Baseline and Designed are synchronized tabs, not a horizontal carousel.
- `Show difference` creates a vertical before/after comparison at the divergence point.
- Audit entries appear as a bottom sheet or inline cards.
- Evidence opens full-screen.
- The browser back action closes evidence before leaving a case.
- Touch targets are at least 44 px.

## 7. Scenario state models

### 7.1 PayFlow Reliability

#### Visitor-adjustable conditions

```ts
type PayflowConditions = {
  callbackDelivery: "once" | "duplicate" | "out-of-order";
  idempotencyBoundary: "absent" | "event-key";
  settlement: "matched" | "mismatched";
  persistence: "available" | "interrupted";
};
```

The initial public demonstration uses `duplicate`, `event-key`, `matched`, and `available`.

#### Projection states

```text
REQUEST_RECEIVED
INTENT_CREATED
CALLBACK_RECEIVED
CALLBACK_MATCHED | CALLBACK_UNMATCHED
STATE_APPLIED | STATE_UNCHANGED | REVIEW_REQUIRED
AUDIT_WRITTEN | AUDIT_PENDING
```

#### Baseline comparison

- No stable idempotency boundary.
- A repeated callback can enter a second processing path.
- Wording must avoid claiming a real second charge unless the public lab actually demonstrates one.

#### Designed comparison

- Callback identity is checked at an explicit boundary.
- The repeated event is acknowledged and recorded.
- Existing payment state remains unchanged.

#### Required evidence

- Existing audit-trail screenshot.
- Existing duplicate-webhook screenshot.
- Public repository link.
- Repository file links for the relevant handler, state model, and tests, after verification.

### 7.2 iYup

#### Visitor-adjustable conditions

```ts
type IyupConditions = {
  healthResponse: "pass" | "fail";
  latency: "normal" | "degraded" | "severe";
  scrapeTarget: "available" | "missing";
  alertRule: "present" | "absent";
};
```

Initial state: health passes while latency degrades.

#### Projection states

```text
SERVICE_RESPONDING
LATENCY_NORMAL | LATENCY_DEGRADED
SAMPLES_PRESENT | SAMPLES_MISSING
THRESHOLD_CLEAR | THRESHOLD_CROSSED
OPERATOR_CONTEXT_PRESENT | OPERATOR_CONTEXT_MISSING
```

#### Important semantic rule

Missing samples never animate toward zero. The visual trace stops and becomes explicitly unknown.

#### Required evidence

- Existing Grafana dashboard screenshot.
- Existing Prometheus targets screenshot.
- Public configuration links for scrape and alert behavior, after verification.

### 7.3 TrustGate Android

#### Visitor-adjustable conditions

```ts
type TrustgateConditions = {
  rootSignal: "clear" | "suspected" | "detected";
  emulatorSignal: "clear" | "detected";
  requestSignature: "valid" | "invalid";
  secureStorage: "available" | "unavailable";
  actionSensitivity: "low" | "high";
};
```

#### Projection states

```text
SIGNALS_COLLECTED
POLICY_EVALUATED
ALLOW | REQUIRE_CONFIRMATION | BLOCK
SECURITY_EVENT_WRITTEN
```

#### Comparison

- Baseline policy: any suspicious environmental signal blocks.
- Designed policy: explicit combinations of signal and action sensitivity produce allow, confirmation, or block.
- No unexplained numerical risk score.

#### Required evidence

- Existing device-risk screenshot.
- Existing local security-event screenshot.
- Public policy and event-model file links, after verification.

## 8. Motion system

### Core rule

Only causal change moves. If an element is unaffected by a condition change, it remains stationary.

### Motion primitives

| Primitive | Meaning |
| --- | --- |
| Rewind | Return affected descendants to the decision point |
| Fork | One shared state gains two possible projections |
| Diverge | Different decisions begin producing different outcomes |
| Reconstruct | Rebuild only states dependent on the changed condition |
| Consequence echo | Show compounding downstream effects |
| Attach | Bind evidence to the state it supports |
| Obscure | Behavior continues while evidence becomes unavailable |
| Converge | Different paths reach the same safe state |

### Condition-change choreography

1. Changed control confirms immediately: 80–120 ms.
2. Affected descendants are identified: 100 ms.
3. Descendants rewind in reverse causal order: 220–420 ms.
4. The divergence boundary changes: 160–240 ms.
5. New descendants reconstruct in causal order: 350–700 ms.
6. Audit explanation updates after the visual consequence: 120–180 ms.

Maximum total duration: 1.4 seconds. Further input either completes the current transition or queues only the latest requested state.

### Easing vocabulary

```css
--ease-event: cubic-bezier(0.32, 0.72, 0, 1);
--ease-rewind: cubic-bezier(0.65, 0, 0.78, 0);
--ease-decision: cubic-bezier(0.16, 1, 0.3, 1);
--ease-linear-signal: linear;
```

### Cold-open choreography

| Time | Event |
| --- | --- |
| 0–300 ms | Stable workspace and initial payment state render |
| 450 ms | Duplicate event appears |
| 800–1800 ms | Both projections advance together |
| 1800 ms | Decision boundary becomes visible |
| 1900–3000 ms | Baseline and designed outcomes diverge |
| 3200 ms | Reasoning appears in audit tape |
| 4000 ms | Identity and scenario index become primary |

The visitor can interrupt immediately. Returning visitors may skip the replay using a local preference, but essential identity content remains in the server-rendered document.

### Motion exclusions

- No cursor-following behavior.
- No scroll hijacking or mandatory scroll snapping.
- No random character scrambling.
- No ambient particles or emojis.
- No decorative parallax.
- No continuous animation after the system reaches rest.
- No animation that hides navigation or delays reading.

## 9. Visual system

### 9.1 Art direction

The visual identity combines three physical references without literally imitating any of them:

1. A payment journal: warm paper, ordered entries, timestamps, and state stamps.
2. A forensic comparison table: equal columns, thin rules, and explicit differences.
3. A system projection: causal connections, boundaries, and reconstructed state.

The result should feel editorial and precise rather than futuristic. It must not resemble a dark developer dashboard, fake terminal, glassmorphism interface, or generic SaaS landing page.

The default page is light because the distinction between ink, erased history, attached evidence, and marked decisions reads more clearly on a paper-like surface. A dark theme is not part of the first implementation; adding one would require a separate semantic palette rather than inverting colors.

### 9.2 Exact color system

```css
:root {
  /* Document */
  --paper: #f4f1ea;
  --paper-raised: #faf8f3;
  --paper-recessed: #eae5dc;
  --paper-cool: #eef2f1;

  /* Typography and structure */
  --ink: #111820;
  --ink-secondary: #4f5a65;
  --ink-tertiary: #747d84;
  --rule: #c9ccc7;
  --rule-strong: #979e9e;

  /* Projection roles */
  --baseline: #697179;
  --baseline-wash: #dfe1de;
  --designed: #155b8f;
  --designed-bright: #1e78b4;
  --designed-wash: #dceaf1;

  /* System state */
  --uncertain: #b66f18;
  --uncertain-wash: #f0dfc5;
  --adverse: #a94743;
  --adverse-wash: #edd8d5;
  --confirmed: #237368;
  --confirmed-wash: #d9e8e3;

  /* Focus and selection */
  --focus: #005fcc;
  --selection: #cfe4f2;
}
```

These values are starting tokens, not permission to use every color at once. At rest, approximately 85% of the screen should use paper, ink, graphite, and rules. Semantic color appears only where the system has made or is awaiting a decision.

Color is never the only state indicator:

- Baseline uses a dashed causal line and `BASELINE` label.
- Designed uses a solid causal line and `DESIGNED` label.
- Uncertainty uses an open diamond marker and `UNRESOLVED` state.
- Adverse outcomes use a stopped line and explicit outcome label.
- Confirmed outcomes use a closed state marker and final-state label.

### 9.3 Case atmospheres

The shell remains consistent, but each case changes the temperature and behavior of the workspace.

| Case | Base atmosphere | Active accent | Visual behavior |
| --- | --- | --- | --- |
| Home / cold open | Warm paper | Designed blue | Neutral system becomes a two-branch comparison |
| PayFlow | Warm neutral | Blue with limited adverse red | Discrete events, ledger rows, and hard state boundaries |
| iYup | Slightly cooler paper | Teal and warning amber | Continuous samples, interrupted traces, and thresholds |
| TrustGate | Warm mineral paper | Amber, blue, and restrained red | Signal influence, explicit policy boundaries, and gated outcomes |
| Career / Brief | Clean warm paper | Ink and designed blue | Accumulating scope without failure-state colors |

The whole page does not abruptly recolor. Case atmosphere is carried by the active workspace, section folio, state markers, and a very low-contrast background field. Navigation and body copy remain stable.

### 9.4 Spatial layers

The interface uses four visual depths:

1. **Document:** flat paper background and fixed global navigation.
2. **Projection:** baseline and designed systems drawn directly on the document.
3. **Decision:** boundaries, changed conditions, and state markers sitting above projections.
4. **Evidence:** screenshots and source references physically attached to a state.

Depth comes from overlap, rules, and scale—not glass blur.

- Document and projection layers have no shadow.
- Controls use a 1 px rule and a 2–4 px radius.
- Evidence exhibits may use `0 18px 50px rgb(17 24 32 / 12%)` because they behave like objects placed above the document.
- Modals use a solid paper scrim rather than a heavily blurred backdrop.
- The baseline grid is 24 px and appears only inside debugger workspaces at 3–4% ink opacity.

### 9.5 Typography

IBM Plex Sans and IBM Plex Mono remain because they fit both editorial reading and technical state without feeling ornamental.

```text
Display thesis       Plex Sans  64–104 px  600  -0.045em
Case consequence     Plex Sans  38–64 px   600  -0.035em
Section heading      Plex Sans  28–40 px   600  -0.025em
Body                 Plex Sans  17–20 px   400   normal
Small explanation    Plex Sans  14–16 px   400   normal
State value          Plex Mono  13–15 px   500   0.02em
Metadata / folio     Plex Mono  11–12 px   500   0.08em uppercase
```

Typography changes state without scrambling characters:

- Shared facts are regular weight.
- A changed assumption becomes medium weight and gains a left marker.
- Consequences use scale and position, not all caps.
- Final states use monospace labels, never giant success messages.
- Rewound descendants retain faint text silhouettes briefly, making removed history legible without looking like a glitch effect.

### 9.6 Lines, markers, and shapes

The causal drawing language is deliberately limited:

```text
●  recorded event
○  pending event
◇  unresolved decision
◆  resolved decision
│  causal continuation
┆  baseline or uncertain relationship
├  fork
└  terminal outcome
```

- Normal rules are 1 px.
- Active causal paths are 2 px.
- Decision boundaries are 3 px only during the moment of divergence, then return to 2 px.
- Rounded pills are avoided except for compact filters.
- State nodes use circles, diamonds, and short labels; icons are not used where a word is clearer.

### 9.7 Visual behavior during animation

Color follows causality. It never washes across the entire screen merely because a new section appears.

#### Resting state

- Both projections are mostly graphite.
- Shared events use `--ink-secondary`.
- The designed accent is visible only in the active condition and final state.
- Background remains `--paper` or the case atmosphere.
- Nothing pulses continuously.

#### Assumption selected

1. The selected control gains an ink outline immediately.
2. Its state marker changes to the relevant semantic color.
3. A 2 px colored causal line travels only to dependent states.
4. Unaffected nodes remain completely stationary and retain their color.

The selection does not flood-fill its entire column.

#### Rewind

1. Semantic color drains from affected descendants toward the divergence boundary over 160–240 ms.
2. Descendant text moves back 4–8 px and becomes `--ink-tertiary`.
3. Causal lines retract rather than fading uniformly.
4. Removed states leave a 120 ms graphite silhouette, then clear.
5. The changed condition remains fully legible throughout.

This reads as history being invalidated, not content disappearing.

#### Fork

1. The shared causal line is ink-colored before the boundary.
2. At the boundary, it widens from 1 px to 3 px for 140 ms.
3. It separates into a dashed graphite baseline path and solid designed path.
4. Both branches initially have equal brightness to avoid declaring a winner before consequences exist.

#### Divergence

1. Identical states stay aligned across both projections.
2. The first differing baseline state shifts 12–20 px left; the designed state shifts the same distance right.
3. Downstream spacing increases slightly at each dependent state, creating a consequence fan.
4. Only after the different outcome is visible does the designed path gain blue.
5. Amber marks uncertainty; muted red is reserved for a defensible adverse outcome.

#### Reconstruction

1. New causal lines draw outward from the changed boundary.
2. Nodes appear in dependency order using a 6 px positional settle, not blur.
3. Each node takes its semantic color only after its label is readable.
4. The audit tape updates last, so prose explains a consequence the visitor has already seen.

#### Evidence opened

1. The state node remains at full contrast.
2. Its evidence connector draws toward the audit tape or exhibit.
3. Unrelated projection content reduces to approximately 72% contrast; it does not blur.
4. The screenshot expands from the connector endpoint using scale and crop interpolation.
5. Annotation lines draw after the image reaches its resting size.

#### Resolution

1. Motion stops completely.
2. The final designed state uses `--confirmed` or `--designed` depending on meaning.
3. The baseline retains graphite, amber, or adverse red.
4. A small outcome sentence becomes the strongest element after the state labels.
5. Controls remain available; there is no celebratory animation.

### 9.8 Cold-open visual progression

| Frame | Surface | Color behavior | Composition |
| --- | --- | --- | --- |
| Initial event | Warm paper | Ink and graphite only | One centered processing record |
| Duplicate arrives | Same paper | Open amber marker appears | Second event aligns beneath the first |
| Shared processing | Same paper | Both paths remain graphite | Workspace quietly expands to two columns |
| Decision exposed | Paper recessed at boundary | Boundary receives blue focus edge | Labels `PROCESS AS NEW` and `MATCH EXISTING` become structural headings |
| Divergence | Split atmosphere | Baseline stays graphite; designed path gains blue after the split | Columns move apart by 24–40 px |
| Consequence | Baseline gains limited adverse tone; designed settles in blue/teal | Results become primary | Identity enters in the negative space created between outcomes |
| Rest | Returns toward warm neutral | Semantic colors remain only on final states | Scenario index and Brief action become available |

The identity is revealed by layout rebalancing rather than fading over the simulation. The two system columns move outward, creating a central editorial space for the name and thesis.

### 9.9 Scenario-to-scenario transition

Switching cases follows a reset-and-rebuild sequence instead of crossfading entire screens:

1. Evidence closes and audit entries collapse into their case folio.
2. Active semantic colors retract to their source nodes.
3. Causal lines rewind to the shared workspace origin.
4. The atmosphere returns to neutral paper for 120–180 ms.
5. The next case changes the meaning of the same workspace geometry.
6. New labels and controls reconstruct from the origin.
7. The next case accent appears only when its first meaningful state is reached.

This avoids muddy direct interpolation from blue to teal or amber and makes the debugger feel like one instrument loading a new model.

### 9.10 Case-specific transformations

#### PayFlow

- Events appear as discrete ledger rows and closed circular nodes.
- Confirmed transaction state uses designed blue.
- Successfully ignored duplicates use desaturated teal, not green celebration.
- Settlement mismatch uses amber until review determines an outcome.
- Red is used only if the public demonstration supports a genuinely adverse state.

#### iYup

- Ledger spacing gradually becomes a time axis.
- Discrete nodes become metric samples without changing their screen position abruptly.
- The workspace cools from `--paper` toward `--paper-cool` at no more than a 12% blend.
- Healthy samples stay graphite; the useful signal becomes teal.
- Threshold crossing is amber.
- Missing telemetry is an interrupted graphite trace with an `UNKNOWN` label, never red and never zero.

#### TrustGate

- Metric samples regroup into named input rows.
- The threshold line becomes a policy boundary.
- Clear evidence stays graphite until evaluated.
- Unresolved combinations use amber and an open diamond.
- Allow uses designed blue, confirmation uses amber, and block uses muted red.
- When an explanation is inspected, only influencing signals gain color; irrelevant signals recede.

#### Career and Brief

- Failure-state colors disappear.
- Blue marks accumulated responsibility and public evidence links.
- Company identity is carried by names and small original logo assets, not large brand-colored sections.
- Scope grows through line length, dependency count, and layout width rather than animated counters.

### 9.11 Controls

- Default controls are paper-colored with ink borders.
- Hover adds a 2 px internal underline or moves an existing marker; controls do not lift or bounce.
- Press compresses only 1 px vertically for tactile response.
- Selected controls use an ink fill with paper text unless semantic color is necessary.
- Focus uses a 2 px `--focus` outline with 3 px offset.
- Disabled scenarios remain readable and explain why they are unavailable.

### 9.12 Evidence treatment

- Screenshots appear as exhibits attached to a state or claim.
- Annotation leaders originate at actual UI evidence.
- Captions state what the screenshot proves.
- Exhibits use the screenshot's natural aspect ratio and avoid decorative device mockups unless the device frame is itself relevant.
- Full-screen evidence supports zoom, panning, keyboard closure, and a plain-text evidence summary.
- Source links identify the repository file and why it matters, not only `View code`.

### 9.13 Recruiter Brief visual treatment

The Brief view intentionally removes the debugger atmosphere:

- Warm paper and ink dominate.
- One blue rule connects current role, selected work, and contact.
- Experience uses responsibility bands rather than animated cards.
- Project summaries retain small baseline/designed comparison marks as a visual connection to the cases.
- The page prints cleanly in grayscale; URLs and evidence labels remain legible.
- No animation is required beyond immediate navigation and disclosure.

### 9.14 Responsive visual behavior

- Desktop uses spatial separation to show divergence.
- Tablet preserves both outcomes but moves the audit tape into a drawer.
- Mobile uses synchronized tabs and a fixed difference marker at the divergence state.
- On mobile, semantic color remains attached to labels and borders because wide causal paths are unavailable.
- Background atmosphere remains subtle at every width; mobile never becomes a stack of brightly colored cards.

### 9.15 Visual acceptance criteria

- A static screenshot is identifiable without relying on motion.
- The baseline and designed systems remain distinguishable in grayscale.
- At least 80% of any resting viewport is neutral paper/ink/graphite.
- No viewport contains more than two semantic accent colors plus neutrals.
- Changing one condition visibly affects only dependent states.
- A visitor can identify the exact divergence point within two seconds.
- Motion always ends in a readable, composed frame.
- Evidence feels attached to a claim rather than displayed as portfolio decoration.

## 10. Brief view content

### Opening

```text
Muhammad A. Fattah
Software Engineer

Building reliable payment systems and secure mobile clients,
with an emphasis on readable state and production evidence.
```

### Immediate facts

- Current: Bank Central Asia — Software Engineer / IT Specialist.
- Focus: Android POS, merchant payments, reliability, and incident recovery.
- Location: Indonesia, UTC+7.
- Links: résumé, GitHub, LinkedIn, email.

### Experience narrative

Experience is ordered by increasing operational responsibility:

1. Apple Developer Academy — prototype delivery.
2. Telkom Indonesia — reusable SwiftUI systems.
3. Bank Central Asia — production payment reliability.

### Technical scope

Technologies appear in a dependency map, not a keyword cloud:

```text
CLIENT → BOUNDARY → STATE → OPERATIONS → DELIVERY
```

### Operating principles

- Retries are part of the system.
- State transitions should remain readable after an incident.
- Missing telemetry is unknown, not zero.
- A security signal is evidence, not automatically a verdict.
- Operational interfaces should support the next decision.

## 11. Evidence and honesty rules

- Never invent production metrics.
- Never imply public labs reproduce BCA internals.
- Separate `professional experience` from `public evidence` visually.
- Label baseline outcomes as illustrative unless reproduced by the public lab.
- Every architecture claim links to code, configuration, screenshot, or a clearly marked explanation.
- Every case includes `What this does not solve`.
- Confidential responsibilities stay generalized.

## 12. Component architecture

```text
app/
  page.tsx
  brief/page.tsx
  evidence/page.tsx
  case/[slug]/page.tsx

components/
  shell/
    portfolio-header.tsx
    scenario-switcher.tsx
    contact-handoff.tsx
  debugger/
    debugger-workspace.tsx
    system-projection.tsx
    divergence-boundary.tsx
    causal-graph.tsx
    assumption-controls.tsx
    audit-tape.tsx
    replay-controls.tsx
  cases/
    payflow-scenario.ts
    iyup-scenario.ts
    trustgate-scenario.ts
  evidence/
    evidence-drawer.tsx
    evidence-exhibit.tsx
    claim-ledger.tsx
  brief/
    profile-summary.tsx
    responsibility-history.tsx
    system-scope-map.tsx
  motion/
    causal-transition.ts
    reduced-motion-projection.tsx

lib/
  scenarios/
    types.ts
    project.ts
    payflow.ts
    iyup.ts
    trustgate.ts
  content/
    experience.ts
    projects.ts
    claims.ts
```

### State-engine contract

Each scenario is a pure projection:

```ts
type ScenarioDefinition<C, S> = {
  initialConditions: C;
  project: (conditions: C, mode: "baseline" | "designed") => S;
  explain: (previous: S, next: S) => AuditEntry[];
  evidence: (state: S) => EvidenceRef[];
};
```

Deterministic projections make reverse animation, deep linking, testing, and reduced-motion output reliable.

## 13. Technical approach

- Next.js App Router and server-rendered identity/content.
- Client components only for scenario controls and causal animation.
- URL search parameters encode scenario conditions for shareable replays.
- SVG renders causal connections; semantic HTML renders all content and controls.
- CSS transforms and opacity handle most motion.
- Web Animations API coordinates reversible transitions.
- Avoid a large animation dependency unless prototype testing proves native orchestration insufficient.
- No canvas for text or essential information.
- Session investigation state remains local and is not transmitted.

## 14. Accessibility

- All assumptions use native buttons, radio groups, or switches.
- Every projection exposes an equivalent ordered textual state list.
- Live announcements summarize final state changes, not every animation frame.
- Keyboard focus never moves automatically during replay.
- Evidence drawer traps focus and restores it on close.
- Baseline/designed comparison does not rely on color.
- Minimum WCAG AA contrast.
- Brief view is the canonical print layout.

### Reduced motion

With `prefers-reduced-motion: reduce`:

- Cold-open animation is skipped.
- Conditions update projections immediately.
- Changed states receive a brief non-motion highlight.
- Cases become ordered comparison plates.
- All evidence and explanations remain available.

## 15. Responsive behavior

| Width | Layout |
| --- | --- |
| `>= 1280` | Three-column workspace |
| `900–1279` | Two projections plus collapsible audit drawer |
| `600–899` | Stacked comparison with sticky condition controls |
| `< 600` | Synchronized baseline/designed tabs and inline audit cards |

No breakpoint removes evidence or technical explanation.

## 16. Performance budget

- Initial JavaScript target: under 170 KB compressed, excluding Next.js framework cost.
- No always-running animation loop.
- Animations use transform and opacity where possible.
- Evidence images load on demand except the first visible exhibit.
- Largest Contentful Paint target: under 2.5 seconds on a representative mobile connection.
- Interaction to Next Paint target: under 200 ms for controls.
- Layout shift target: under 0.05.

## 17. Analytics

Only aggregate, non-sensitive events should be considered:

- Brief opened.
- Case selected.
- Evidence opened.
- Repository, résumé, email, or LinkedIn handoff selected.

Do not transmit individual scenario settings or construct visitor profiles from investigation paths.

## 18. Implementation sequence

### Phase 0 — Content verification

- Verify public repository behavior and relevant code links.
- Confirm résumé asset and preferred availability wording.
- Validate career dates and role descriptions.
- Mark illustrative baseline behavior precisely.

### Phase 1 — Static prototype

- Build the Brief route first.
- Build the case workspace without animation.
- Validate information hierarchy on desktop and mobile.

### Phase 2 — Deterministic scenario engine

- Implement pure projections and audit explanations.
- Add unit tests for condition combinations.
- Encode conditions in shareable URLs.

### Phase 3 — Causal motion

- Implement rewind, divergence, and reconstruction.
- Add interruption and rapid-input handling.
- Build the cold-open replay.

### Phase 4 — Evidence and career

- Attach screenshots and verified source links.
- Build claim ledger and system-scope map.
- Add résumé and handoff behavior.

### Phase 5 — Replacement and hardening

- Remove the current embedded interaction script.
- Remove superseded CSS and decorative assets.
- Complete accessibility, responsive, performance, and browser testing.
- Run lint and production build.

## 19. Acceptance criteria

The redesign is ready when:

- A recruiter can identify role, current company, focus, experience, and contact within 15 seconds.
- An engineer can change a condition and understand the resulting causal difference without explanatory onboarding.
- Every case is useful with JavaScript disabled or reduced motion enabled.
- Every professional claim is clearly separated from public project evidence.
- All case URLs are directly shareable.
- Rapidly changing controls never produces impossible intermediate states.
- Keyboard and touch users can complete every investigation.
- No continuous decorative motion remains at rest.
- The production build, lint, accessibility review, and target viewport checks pass.

## 20. Inputs needed before implementation

1. Current résumé PDF, if it should be downloadable.
2. Whether to state availability for new roles.
3. Confirmation that the existing career dates and titles are final.
4. Permission to deep-link specific public repository files after verification.
5. Any public, defensible project results or limitations not already documented.

Absent these inputs, implementation can proceed using current public facts, with résumé and availability omitted and unverified claims excluded.
