/**
 * services/CompositionXmlBuilder.js
 * Builds the MDS-UPDRS composition as openEHR "canonical" XML (not FLAT —
 * EHRbase couldn't resolve any FLAT paths, likely a template mismatch).
 * Part I, II and IV are omitted: optional (min=0) and have no fillable fields yet.
 *
 * Created with the assistance of Claude AI, subsequently reviewed and adapted.
 */

// Fixed markers, known from the web template, for the two ITEM_TREEs
const DATA_TREE_MARKER = '/data[at0003]/';
const STATE_TREE_MARKER = '/state[at0228]/';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeTime(value) {
  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
}


function normalizeDuration(value) {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    return `PT${Number(value)}M`;
  }
  
  return value;
}

/** Renders a single ELEMENT (leaf) as XML, depending on its RM type. */
function renderElement(atCode, field, value) {
  const name = esc(field.name);

  switch (field.rmType) {
    case 'DV_ORDINAL': {
      const opt = field.options.find((o) => o.value === value);
      if (!opt) return '';
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_ORDINAL">
    <value>${opt.ordinal}</value>
    <symbol>
      <value>${esc(opt.label)}</value>
      <defining_code>
        <terminology_id><value>external</value></terminology_id>
        <code_string>${opt.value}</code_string>
      </defining_code>
    </symbol>
  </value>
</items>`;
    }
    case 'DV_CODED_TEXT': {
      const opt = field.options.find((o) => o.value === value);
      if (!opt) return '';
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_CODED_TEXT">
    <value>${esc(opt.label)}</value>
    <defining_code>
      <terminology_id><value>local</value></terminology_id>
      <code_string>${opt.value}</code_string>
    </defining_code>
  </value>
</items>`;
    }
    case 'DV_BOOLEAN':
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_BOOLEAN"><value>${value ? 'true' : 'false'}</value></value>
</items>`;
    case 'DV_COUNT':
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_COUNT"><magnitude>${Number(value)}</magnitude></value>
</items>`;
    case 'DV_TIME':
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_TIME"><value>${esc(normalizeTime(value))}</value></value>
</items>`;
    case 'DV_DURATION':
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_DURATION"><value>${esc(normalizeDuration(value))}</value></value>
</items>`;
    case 'DV_DATE_TIME':
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_DATE_TIME"><value>${esc(value)}</value></value>
</items>`;
    default:
      return `<items xsi:type="ELEMENT" archetype_node_id="${atCode}">
  <name><value>${name}</value></name>
  <value xsi:type="DV_TEXT"><value>${esc(value)}</value></value>
</items>`;
  }
}

function renderCluster(clusterAtCode, name, childrenXml) {
  return `<items xsi:type="CLUSTER" archetype_node_id="${clusterAtCode}">
  <name><value>${esc(name)}</value></name>
  ${childrenXml.join('\n')}
</items>`;
}

/**
 * Groups the filled-in Part III fields by ITEM_TREE (data / state)
 * and, where present, by their CLUSTER parent node — then renders
 * everything as XML.
 */
function buildPart3Items(fields, values) {
  const dataItems = [];
  const stateItems = [];
  const clusters = new Map(); 

  for (const field of fields) {
    const value = values[field.aqlPath];
    if (value === null || value === undefined || value === '') continue;

    let container = null;
    let rest = null;
    if (field.aqlPath.includes(DATA_TREE_MARKER)) {
      container = 'data';
      rest = field.aqlPath.split(DATA_TREE_MARKER)[1];
    } else if (field.aqlPath.includes(STATE_TREE_MARKER)) {
      container = 'state';
      rest = field.aqlPath.split(STATE_TREE_MARKER)[1];
    } else {
      continue; 
    }

    rest = rest.replace(/\/value$/, '');
    const segs = [...rest.matchAll(/items\[(at\d+)\]/g)].map((m) => m[1]);
    if (segs.length === 0) continue;

    const elementXml = renderElement(segs[segs.length - 1], field, value);
    if (!elementXml) continue;

    if (segs.length === 1) {
      (container === 'data' ? dataItems : stateItems).push(elementXml);
    } else {
      
      const clusterAtCode = segs[0];
      if (!clusters.has(clusterAtCode)) {
        clusters.set(clusterAtCode, { name: field.cluster, children: [] });
      }
      clusters.get(clusterAtCode).children.push(elementXml);
    }
  }

  for (const [atCode, cluster] of clusters.entries()) {
    dataItems.push(renderCluster(atCode, cluster.name, cluster.children));
  }

  return { dataItemsXml: dataItems.join('\n'), stateItemsXml: stateItems.join('\n') };
}

/**
 * @param {object} opts - templateId, fields (from parseTemplate), values ({aqlPath: value}
 *   from the form), composerName, subjectName, startTime (ISO), location, siteId
 * @returns {string} the complete composition as an XML string
 */
export function buildCompositionXml({ templateId, fields, values, composerName, subjectName, startTime, location, siteId }) {
  const now = startTime || new Date().toISOString();
  const part3Fields = fields.filter(
    (f) => f.aqlPath.includes(DATA_TREE_MARKER) || f.aqlPath.includes(STATE_TREE_MARKER)
  );
  const { dataItemsXml, stateItemsXml } = buildPart3Items(part3Fields, values);

  const stateBlock = stateItemsXml
    ? `<state xsi:type="ITEM_TREE" archetype_node_id="at0228">
          <name><value>Item tree</value></name>
          ${stateItemsXml}
        </state>`
    : '';

  const otherContextBlock = siteId
    ? `<other_context xsi:type="ITEM_TREE" archetype_node_id="at0001">
      <name>
        <value>Tree</value>
      </name>
      <items xsi:type="ELEMENT" archetype_node_id="at0036">
        <name>
          <value>Site ID</value>
        </name>
        <value xsi:type="DV_TEXT">
          <value>${esc(siteId)}</value>
        </value>
      </items>
    </other_context>`
    : '';

  return `<composition xmlns="http://schemas.openehr.org/v1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" archetype_node_id="openEHR-EHR-COMPOSITION.report.v1">
  <name>
    <value>${esc(templateId)}</value>
  </name>
  <archetype_details>
    <archetype_id>
      <value>openEHR-EHR-COMPOSITION.report.v1</value>
    </archetype_id>
    <template_id>
      <value>${esc(templateId)}</value>
    </template_id>
    <rm_version>1.0.4</rm_version>
  </archetype_details>
  <language>
    <terminology_id>
      <value>ISO_639-1</value>
    </terminology_id>
    <code_string>en</code_string>
  </language>
  <territory>
    <terminology_id>
      <value>ISO_3166-1</value>
    </terminology_id>
    <code_string>DE</code_string>
  </territory>
  <category>
    <value>event</value>
    <defining_code>
      <terminology_id>
        <value>openehr</value>
      </terminology_id>
      <code_string>433</code_string>
    </defining_code>
  </category>
  <composer xsi:type="PARTY_IDENTIFIED">
    <name>${esc(composerName ?? 'MDS-UPDRS Form')}</name>
  </composer>
  <context>
    <start_time>
      <value>${now}</value>
    </start_time>
    <location>${esc(location ?? 'n/a')}</location>
    <setting>
      <value>secondary medical care</value>
      <defining_code>
        <terminology_id>
          <value>openehr</value>
        </terminology_id>
        <code_string>232</code_string>
      </defining_code>
    </setting>
    ${otherContextBlock}
  </context>
  <content xsi:type="SECTION" archetype_node_id="openEHR-EHR-SECTION.part_iii.v0">
    <name>
      <value>Part III</value>
    </name>
    <archetype_details>
      <archetype_id>
        <value>openEHR-EHR-SECTION.part_iii.v0</value>
      </archetype_id>
      <rm_version>1.0.4</rm_version>
    </archetype_details>
    <items xsi:type="OBSERVATION" archetype_node_id="openEHR-EHR-OBSERVATION.updrs_part_iii.v0">
      <name>
        <value>Motor Examination</value>
      </name>
      <archetype_details>
        <archetype_id>
          <value>openEHR-EHR-OBSERVATION.updrs_part_iii.v0</value>
        </archetype_id>
        <rm_version>1.0.4</rm_version>
      </archetype_details>
      <language>
        <terminology_id>
          <value>ISO_639-1</value>
        </terminology_id>
        <code_string>en</code_string>
      </language>
      <encoding>
        <terminology_id>
          <value>IANA_character-sets</value>
        </terminology_id>
        <code_string>ISO-10646-UTF-1</code_string>
      </encoding>
      <subject xsi:type="PARTY_IDENTIFIED">
        <name>${esc(subjectName || 'Unknown')}</name>
      </subject>
      <data archetype_node_id="at0001">
        <name>
          <value>History</value>
        </name>
        <origin>
          <value>${now}</value>
        </origin>
        <events xsi:type="POINT_EVENT" archetype_node_id="at0002">
          <name>
            <value>Any event</value>
          </name>
          <time>
            <value>${now}</value>
          </time>
          <data xsi:type="ITEM_TREE" archetype_node_id="at0003">
            <name>
              <value>Tree</value>
            </name>
            ${dataItemsXml}
          </data>
          ${stateBlock}
        </events>
      </data>
    </items>
  </content>
</composition>`;
}