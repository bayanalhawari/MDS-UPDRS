/**
 * Parses an openEHR Web Template JSON into a flat list of form fields,
 * grouped by section, observation, and (where present) cluster.
 */

import { SCORE_AQL_PATHS, TOTAL_SCORE_AQL } from './scoreAqlPaths';

// re-exported so existing imports (`from './templateParser'`) keep working
export { SCORE_AQL_PATHS, TOTAL_SCORE_AQL };

const SKIP_RM_TYPES = new Set([
  'COMPOSITION', 'EVENT_CONTEXT', 'PARTICIPATION', 'PARTY_IDENTIFIED',
  'PARTY_REF', 'OBJECT_ID', 'SECTION', 'OBSERVATION', 'EVALUATION',
  'ADMIN_ENTRY', 'CLUSTER', 'ELEMENT', 'PARTY_PROXY',
]);

function extractOptions(inputs) {
  const options = [];
  for (const inp of inputs) {
    if (inp.list) {
      for (const item of inp.list) {
        options.push({
          value: item.value,
          label: item.localizedLabels?.en ?? item.label,
          description: item.localizedDescriptions?.en ?? '',
          ordinal: item.ordinal ?? null,
        });
      }
    }
  }
  return options;
}

function walk(node, ctx, results) {
  const name = node.localizedName ?? node.name ?? '';
  const rmType = node.rmType ?? '';

  const cur = { ...ctx };

  // Build the cumulative "flat path" (id segments joined by "/") for this node.
  // This mirrors the path shape EHRbase uses for FLAT-format composition data
  // (e.g. "part_iii/motor_examination/any_event/a3.1._speech"), so results
  // returned from GET .../composition?format=FLAT can later be matched back
  // to this field by id path. The composition root itself is excluded.
  if (rmType === 'COMPOSITION') {
    cur.idPath = '';
  } else if (node.id) {
    cur.idPath = ctx.idPath ? `${ctx.idPath}/${node.id}` : node.id;
  }

  if (rmType === 'SECTION') {
    cur.section = name;
  } else if (rmType === 'OBSERVATION' || rmType === 'EVALUATION') {
    cur.observation = name;
  } else if (rmType === 'CLUSTER') {
    // FIX: cluster name AND description are captured here and carried
    // down to every child field via ctx, so the description is not lost.
    cur.cluster = name;
    cur.clusterDescription = node.localizedDescriptions?.en ?? '';
    cur.clusterAqlPath = node.aqlPath ?? '';
  }

  const inputs = node.inputs ?? [];
  const inContext = node.inContext ?? false;

  if (inputs.length > 0 && !SKIP_RM_TYPES.has(rmType) && !inContext && name) {
    const primaryInput = inputs[0];
    results.push({
      // identity
      id: node.id,
      aqlPath: node.aqlPath ?? '',
      idPath: cur.idPath ?? '',
      // grouping
      section: cur.section,
      observation: cur.observation,
      cluster: cur.cluster,
      clusterDescription: cur.clusterDescription ?? '',
      clusterAqlPath: cur.clusterAqlPath ?? '',
      // display
      name,
      description: node.localizedDescriptions?.en ?? '',
      // field type
      rmType,
      inputType: primaryInput.type,
      options: extractOptions(inputs),
      validation: primaryInput.validation ?? null,
      // cardinality
      required: (node.min ?? 0) > 0,
      multiple: (node.max ?? 1) > 1 || node.max === -1,
    });
  }

  for (const child of node.children ?? []) {
    walk(child, cur, results);
  }
}

/**
 * @param {object} template - parsed JSON from the openEHR web template
 * @returns {{ sections: string[], fields: object[], grouped: object }}
 *
 * `grouped` shape: { [section]: { [observation]: item[] } }
 * where each `item` is either:
 *   - { kind: 'field', ...field }                                    (standalone field)
 *   - { kind: 'cluster', name, description, aqlPath, fields: field[] } (cluster group)
 */
export function parseTemplate(template) {
  const fields = [];
  walk(
    template.tree,
    { section: '', observation: '', cluster: '', clusterDescription: '', clusterAqlPath: '', idPath: '' },
    fields
  );

  const grouped = {};
  for (const field of fields) {
    const sec = field.section || 'General';
    const obs = field.observation || 'General';
    if (!grouped[sec]) grouped[sec] = {};
    if (!grouped[sec][obs]) grouped[sec][obs] = [];
    const bucket = grouped[sec][obs];

    if (field.cluster) {
      // FIX: group all fields belonging to the same cluster together,
      // and attach the cluster's own name + description exactly once.
      let clusterItem = bucket.find(
        (item) => item.kind === 'cluster' && item.aqlPath === field.clusterAqlPath
      );
      if (!clusterItem) {
        clusterItem = {
          kind: 'cluster',
          name: field.cluster,
          description: field.clusterDescription,
          aqlPath: field.clusterAqlPath,
          fields: [],
        };
        bucket.push(clusterItem);
      }
      clusterItem.fields.push({ kind: 'field', ...field });
    } else {
      bucket.push({ kind: 'field', ...field });
    }
  }

  const sections = Object.keys(grouped);
  return { fields, grouped, sections, meta: { templateId: template.templateId, version: template.version } };
}

/**
 * Maps rmType / inputType to a simple widget type for the form renderer.
 */
// The "Last levodopa dose" field (at0235) is modeled in the archetype as
// DV_TIME (hh:mm), but per its description it actually captures the
// *elapsed minutes* since the last dose, not a wall-clock time. A native
// time-of-day picker is confusing here, so this one field gets a plain
// minutes-number input instead; the conversion back to hh:mm:ss happens
// in compositionXmlBuilder.js when the composition is built.
const MINUTES_INPUT_MARKER = 'items[at0235]';

export function getWidgetType(field) {
  const { rmType, inputType, aqlPath } = field;

  if (rmType === 'DV_BOOLEAN' || inputType === 'BOOLEAN') return 'boolean';
  if (rmType === 'DV_ORDINAL') return 'ordinal';           // 0–4 scale with labels
  if (rmType === 'DV_CODED_TEXT' && field.options.length) return 'select';
  if (rmType === 'DV_DATE_TIME' || inputType === 'DATETIME') return 'datetime';
  if (rmType === 'DV_DURATION') return 'minutes';
  if (rmType === 'DV_TIME' || inputType === 'TIME') return 'time';
  if (rmType === 'DV_COUNT' || inputType === 'INTEGER') return 'number';
  if (rmType === 'DV_QUANTITY') return 'quantity';
  if (rmType === 'DV_TEXT' || inputType === 'TEXT') return 'text';
  return 'text';
}


/**
 * Validate a single field value.
 * Returns null if valid, error string otherwise.
 */
export function validateField(field, value) {
  if (field.required && (value === null || value === undefined || value === '')) {
    return `"${field.name}" is required.`;
  }
  return null;
}

/**
 * Given the current values map and the parsed fields list, looks up the ordinal
 * integer for each scoring field and returns their sum (null if none answered yet).
 *
 * The openEHR coded-text value stored is an "at-code" (e.g. "at0006").
 * We resolve it back to the numeric ordinal via the field's options list.
 */
export function computeTotalScore(values, fields) {
  // Build a lookup: aqlPath → options[]
  const optionsByPath = {};
  for (const f of fields) {
    if (SCORE_AQL_PATHS.has(f.aqlPath)) {
      optionsByPath[f.aqlPath] = f.options;
    }
  }

  let sum = 0;
  let answered = 1;

  for (const [aqlPath, options] of Object.entries(optionsByPath)) {
    const atCode = values[aqlPath];
    if (atCode == null) continue;
    const opt = options.find((o) => o.value === atCode);
    if (opt != null && opt.ordinal != null) {
      sum += opt.ordinal;
      answered++;
    }
  }

  return answered > 0 ? sum : null;
}

/**
 * Strips repeating-container index markers (":0", ":1", ...) and the
 * trailing "|code" / "|value" / ... suffix off a FLAT-format path, so it
 * can be matched back against a field's idPath.
 */
function normalizeFlatKey(rawPath) {
  const [pathPart, suffix] = rawPath.split('|');
  return { idPath: pathPart.replace(/:\d+/g, ''), suffix: suffix ?? null };
}

/** Builds a lookup of idPath → field, for every field that has one. */
export function buildFieldIndex(fields) {
  const index = new Map();
  for (const f of fields) {
    if (f.idPath) index.set(f.idPath, f);
  }
  return index;
}

/** Turns a raw idPath ("part_iii/motor_examination/any_event/a3.1._speech")
 *  into a readable fallback label when no template field matches it. */
function humanizeIdPath(idPath) {
  const last = idPath.split('/').pop() ?? idPath;
  return last
    .replace(/^a?(\d+(\.\d+)?)\._?/, '$1 ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Groups a FLAT-format composition object (as returned by EHRbase,
 * `{ "path|code": ..., "path|value": ..., ... }`) into one clinically
 * readable row per data item, resolved against the parsed template so
 * items show their real MDS-UPDRS label, section and (for ordinal/coded
 * items) severity score instead of raw AQL/FLAT paths.
 *
 * @param {object} flat - the `composition` object from getComposition()
 * @param {object[]} fields - `fields` from parseTemplate(template)
 * @returns {{ section: string, observation: string, items: object[] }[]}
 */
export function groupFlatComposition(flat, fields) {
  const fieldIndex = buildFieldIndex(fields);
  const groups = new Map(); // idPath -> { values: {suffix: val}, raw: [path] }

  for (const [rawPath, value] of Object.entries(flat ?? {})) {
    const { idPath, suffix } = normalizeFlatKey(rawPath);
    if (!groups.has(idPath)) groups.set(idPath, { values: {}, raw: [] });
    const g = groups.get(idPath);
    g.values[suffix ?? '_plain'] = value;
    g.raw.push([rawPath, value]);
  }

  const rows = [];
  for (const [idPath, g] of groups.entries()) {
    const field = fieldIndex.get(idPath);
    const code = g.values.code ?? g.values._plain ?? null;
    let displayValue = g.values.value ?? g.values._plain ?? code;
    let ordinal = null;

    if (field?.options?.length && code != null) {
      const opt = field.options.find((o) => o.value === code);
      if (opt) {
        displayValue = opt.label;
        ordinal = opt.ordinal ?? null;
      }
    }

    if (displayValue == null) continue; // pure metadata (language/encoding/etc.) with nothing to show

    rows.push({
      idPath,
      label: field?.name ?? humanizeIdPath(idPath),
      description: field?.description ?? '',
      section: field?.section || 'Other',
      observation: field?.observation || '',
      cluster: field?.cluster || '',
      value: displayValue,
      ordinal,
      raw: g.raw,
    });
  }

  // group into section → observation → items, preserving a stable order
  const bySection = new Map();
  for (const row of rows) {
    if (!bySection.has(row.section)) bySection.set(row.section, new Map());
    const byObs = bySection.get(row.section);
    if (!byObs.has(row.observation)) byObs.set(row.observation, []);
    byObs.get(row.observation).push(row);
  }

  const out = [];
  for (const [section, byObs] of bySection.entries()) {
    for (const [observation, items] of byObs.entries()) {
      out.push({ section, observation, items });
    }
  }
  return out;
}