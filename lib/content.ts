export const experience = [
  {
    company: "Bank Central Asia",
    role: "Software Engineer / IT Specialist",
    period: "Sep 2023 — Present",
    stage: "Production reliability",
    scope: "Android POS delivery, merchant payment recovery, and operational reliability under live transaction load.",
    details: [
      "Kotlin and Java payment work across AIDL, REST APIs, WebSocket, and secure service boundaries.",
      "Repeated callbacks, stuck transactions, and merchant-facing incident recovery.",
      "Release coordination with QA, security, infrastructure, operations, and early iOS merchant support.",
    ],
  },
  {
    company: "Telkom Indonesia",
    role: "iOS Engineer Intern",
    period: "Apr 2023 — Sep 2023",
    stage: "Reusable systems",
    scope: "Shared SwiftUI components for teams delivering government-facing application surfaces.",
    details: [
      "Reusable SwiftUI components across multiple product tracks.",
      "Shared layouts and interaction patterns other developers could adopt quickly.",
      "Feature integration and cleanup work that kept components maintainable.",
    ],
  },
  {
    company: "Apple Developer Academy",
    role: "iOS Developer",
    period: "Feb 2022 — Dec 2022",
    stage: "Prototype delivery",
    scope: "Cross-functional SwiftUI products taken from discovery through demo-ready prototypes.",
    details: [
      "Four prototypes spanning health, reading support, reflection, and relationship products.",
      "Implementation aligned with product, design, and business teammates.",
      "Discovery, prototyping, testing, and iteration toward usable releases.",
    ],
  },
] as const;

export const systemScope = [
  { label: "Client", value: "Kotlin · Java · Android · Jetpack Compose · Swift · SwiftUI" },
  { label: "Boundary", value: "REST · WebSocket · AIDL · request signing" },
  { label: "State", value: "Spring Boot · Kafka · Oracle SQL · PostgreSQL" },
  { label: "Operations", value: "Prometheus · Grafana · Dynatrace · Elasticsearch" },
  { label: "Delivery", value: "Docker · Kubernetes · Jenkins · GitHub Actions" },
] as const;

export const principles = [
  "Retries are part of the system, not an edge case.",
  "State transitions should remain readable after an incident.",
  "Missing telemetry is unknown, not zero.",
  "A security signal is evidence, not automatically a verdict.",
  "Operational interfaces should support the next decision.",
] as const;

export const additionalRepos = [
  { name: "SnapSort-iOS", detail: "iOS photo management", href: "https://github.com/fattah247/SnapSort-iOS" },
  { name: "Stock-Triage", detail: "IDX filing automation", href: "https://github.com/fattah247/Stock-Triage" },
  { name: "Xpire", detail: "Expiration reminders", href: "https://github.com/fattah247/Xpire" },
  { name: "IoTifyHome", detail: "Smart-home control", href: "https://github.com/fattah247/IoTifyHome" },
] as const;
