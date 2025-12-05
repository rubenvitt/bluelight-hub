# Architecture Decision Records (ADRs)

Dieses Verzeichnis enthält Architecture Decision Records (ADRs) für das Bluelight Hub Projekt.

## Was sind ADRs?

Architecture Decision Records dokumentieren wichtige architekturelle Entscheidungen im Projekt. Jedes ADR beschreibt:

- **Kontext:** Warum wurde die Entscheidung benötigt?
- **Entscheidung:** Was wurde entschieden?
- **Konsequenzen:** Welche Auswirkungen hat die Entscheidung?

## ADR Index

| ADR | Titel | Status | Datum |
|-----|-------|--------|-------|
| [ADR-024](./ADR-024-repository-interface-pattern.md) | Repository Interface Return-Type Pattern | Accepted | 2025-12-03 |
| [ADR-025](./ADR-025-hexagonal-architecture.md) | Hexagonale Architektur | Accepted | 2025-12-05 |
| [ADR-026](./ADR-026-strangler-fig-migration-pattern.md) | Strangler Fig Migration Pattern | Accepted | 2025-12-05 |
| [ADR-027](./ADR-027-cqrs-command-query-separation.md) | CQRS (Command Query Responsibility Segregation) | Accepted | 2025-12-05 |
| [ADR-028](./ADR-028-transactional-outbox-pattern.md) | Transactional Outbox Pattern | Accepted | 2025-12-05 |

## ADR Status

- **Proposed:** Entscheidung in Diskussion
- **Accepted:** Entscheidung angenommen und gültig
- **Deprecated:** Entscheidung überholt, aber noch gültig
- **Superseded:** Entscheidung durch neueres ADR ersetzt

## Weitere ADRs

Ältere ADRs sind in der zentralen Architektur-Dokumentation dokumentiert:

- [docs/architecture/9-architecture-decisions-adrs.md](../architecture/9-architecture-decisions-adrs.md)

Diese ADRs (ADR-001 bis ADR-022) wurden vor Einführung des separaten ADR-Verzeichnisses erstellt.

## Neue ADRs erstellen

1. Kopiere das Template aus einem bestehenden ADR
2. Nummeriere fortlaufend (ADR-025, ADR-026, ...)
3. Verwende das Format: `ADR-XXX-kurze-beschreibung.md`
4. Aktualisiere diesen Index
5. Verlinke das ADR in der relevanten Architektur-Dokumentation
