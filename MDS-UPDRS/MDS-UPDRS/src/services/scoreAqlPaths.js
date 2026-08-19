/**
 * AQL-Pfade aller DV_ORDINAL-Felder, die in den MDS-UPDRS Part-III-Gesamtscore
 * (3.1–3.18). The total_score itself is deliberately NOT included here —
 * er wird berechnet, nicht eingegeben.
 *
 * Ausgelagert in eine eigene Datei, damit templateParser.js kurz und auf die
 * eigentliche Parsing-Logik fokussiert bleibt.
 */

const BASE = '/content[openEHR-EHR-SECTION.part_iii.v0]' +
  '/items[openEHR-EHR-OBSERVATION.updrs_part_iii.v0]' +
  '/data[at0001]/events[at0002]/data[at0003]';

export const SCORE_AQL_PATHS = new Set([
  `${BASE}/items[at0005]/value`,                     // 3.1  Speech
  `${BASE}/items[at0011]/value`,                     // 3.2  Facial expression
  `${BASE}/items[at0020]/items[at0021]/value`,       // 3.3  Rigidity — Neck
  `${BASE}/items[at0020]/items[at0022]/value`,       //      Rigidity — RUE
  `${BASE}/items[at0020]/items[at0023]/value`,       //      Rigidity — LUE
  `${BASE}/items[at0020]/items[at0024]/value`,       //      Rigidity — RLE
  `${BASE}/items[at0020]/items[at0025]/value`,       //      Rigidity — LLE
  `${BASE}/items[at0051]/items[at0052]/value`,       // 3.4  Finger tapping — RH
  `${BASE}/items[at0051]/items[at0053]/value`,       //      Finger tapping — LH
  `${BASE}/items[at0064]/items[at0065]/value`,       // 3.5  Hand movements — RH
  `${BASE}/items[at0064]/items[at0066]/value`,       //      Hand movements — LH
  `${BASE}/items[at0077]/items[at0078]/value`,       // 3.6  Pronation-supination — RH
  `${BASE}/items[at0077]/items[at0079]/value`,       //      Pronation-supination — LH
  `${BASE}/items[at0095]/items[at0096]/value`,       // 3.7  Toe tapping — RF
  `${BASE}/items[at0095]/items[at0097]/value`,       //      Toe tapping — LF
  `${BASE}/items[at0108]/items[at0109]/value`,       // 3.8  Leg agility — RL
  `${BASE}/items[at0108]/items[at0110]/value`,       //      Leg agility — LL
  `${BASE}/items[at0121]/value`,                     // 3.9  Arising from chair
  `${BASE}/items[at0127]/value`,                     // 3.10 Gait
  `${BASE}/items[at0133]/value`,                     // 3.11 Freezing of gait
  `${BASE}/items[at0139]/value`,                     // 3.12 Postural stability
  `${BASE}/items[at0145]/value`,                     // 3.13 Posture
  `${BASE}/items[at0151]/value`,                     // 3.14 Global spontaneity (bradykinesia)
  `${BASE}/items[at0157]/items[at0158]/value`,       // 3.15 Postural tremor — RH
  `${BASE}/items[at0157]/items[at0159]/value`,       //      Postural tremor — LH
  `${BASE}/items[at0170]/items[at0171]/value`,       // 3.16 Kinetic tremor — RH
  `${BASE}/items[at0170]/items[at0172]/value`,       //      Kinetic tremor — LH
  `${BASE}/items[at0183]/items[at0184]/value`,       // 3.17 Rest tremor — RUE
  `${BASE}/items[at0183]/items[at0185]/value`,       //      Rest tremor — LUE
  `${BASE}/items[at0183]/items[at0186]/value`,       //      Rest tremor — RLE
  `${BASE}/items[at0183]/items[at0187]/value`,       //      Rest tremor — LLE
  `${BASE}/items[at0183]/items[at0188]/value`,       //      Rest tremor — Lip/Jaw
  `${BASE}/items[at0214]/value`,                     // 3.18 Constancy of rest tremor
]);

/** AQL path of the total_score field (written by the form, read-only for users) */
export const TOTAL_SCORE_AQL = `${BASE}/items[at0227]/value`;
