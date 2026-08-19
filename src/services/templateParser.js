/**
 * Parses an openEHR Web Template JSON into a flat list of form fields,
 * grouped by section, observation, and (where present) cluster.
 *
 * Note: No ready-made / off-the-shelf parser for converting an openEHR
 * web template into a form could be found online, so this parser was
 * generated with the assistance of Claude AI and subsequently reviewed
 * and adapted.
 */

import { SCORE_AQL_PATHS, TOTAL_SCORE_AQL } from './scoreAqlPaths';
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
    cur.cluster = name;
    cur.clusterDescription = node.localizedDescriptions?.en ?? '';
    cur.clusterAqlPath = node.aqlPath ?? '';
  }

  const inputs = node.inputs ?? [];
  const inContext = node.inContext ?? false;

  if (inputs.length > 0 && !SKIP_RM_TYPES.has(rmType) && !inContext && name) {
    const primaryInput = inputs[0];
    results.push({
      id: node.id,
      aqlPath: node.aqlPath ?? '',
      idPath: cur.idPath ?? '',
      section: cur.section,
      observation: cur.observation,
      cluster: cur.cluster,
      clusterDescription: cur.clusterDescription ?? '',
      clusterAqlPath: cur.clusterAqlPath ?? '',
      name,
      description: node.localizedDescriptions?.en ?? '',
      rmType,
      inputType: primaryInput.type,
      options: extractOptions(inputs),
      validation: primaryInput.validation ?? null,
      required: (node.min ?? 0) > 0,
      multiple: (node.max ?? 1) > 1 || node.max === -1,
    });
  }

  for (const child of node.children ?? []) {
    walk(child, cur, results);
  }
}

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

export function computeTotalScore(values, fields) {
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


function normalizeFlatKey(rawPath) {
  const [pathPart, suffix] = rawPath.split('|');
  return { idPath: pathPart.replace(/:\d+/g, ''), suffix: suffix ?? null };
}
export function buildFieldIndex(fields) {
  const index = new Map();
  for (const f of fields) {
    if (f.idPath) index.set(f.idPath, f);
  }
  return index;
}

function humanizeIdPath(idPath) {
  const last = idPath.split('/').pop() ?? idPath;
  return last
    .replace(/^a?(\d+(\.\d+)?)\._?/, '$1 ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function groupFlatComposition(flat, fields) {
  const fieldIndex = buildFieldIndex(fields);
  const groups = new Map(); 

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

    if (displayValue == null) continue; 

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