/**
 * Barrel-Export für das Patienten-Event-Framework (Story 1.1, Issue #417).
 *
 * Story 1.1 hat die Basis + vier konkrete Event-Klassen geliefert; Story 1.3
 * ergänzt `PatientSichtungAktualisiert` (Reevaluierung, fachlich getrennt von
 * der initialen `PatientGesichtet`-Sichtung) und schließt die 4-Punkt-Registry
 * für `PatientGesichtet` und `PatientSichtungAktualisiert` (Architecture §D-6,
 * AR6 — Story 1.2 hatte nur `patient.erfasst` produktiv verdrahtet).
 *
 * Die übrigen Patient-Events (`PatientBehandlungAbgeschlossen`,
 * `PatientTransportAbgeschlossen`, `PatientKorrigiert`, `StandaloneSessionAttached`)
 * folgen in den nachfolgenden Stories (1.4 ff.).
 */
export { PatientDomainEvent } from './patient-domain-event';
export { PatientErfasst } from './patient-erfasst.event';
export { PatientGesichtet } from './patient-gesichtet.event';
export { PatientSichtungAktualisiert } from './patient-sichtung-aktualisiert.event';
export { PatientBehandlungBegonnen } from './patient-behandlung-begonnen.event';
export { PatientTransportGestartet } from './patient-transport-gestartet.event';
