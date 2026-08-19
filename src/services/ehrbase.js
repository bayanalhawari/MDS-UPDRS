/**
 * services/ehrbase.js
 * Thin API client for EHRbase: creating an EHR, writing a composition
 * (assessment) as XML, and reading it back in FLAT format for display.
 *
 * Created with the assistance of Claude AI, subsequently reviewed and adapted.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_EHRBASE_URL;
const TEMPLATE_ID = import.meta.env.VITE_TEMPLATE_ID;

/** Creates a new EHR for a patient/subject and returns its EHR ID. */
export async function createEhr(subjectId) {
  const ehrStatus = {
    _type: "EHR_STATUS",
    archetype_node_id: "openEHR-EHR-EHR_STATUS.generic.v1",
    name: {
      value: "EHR Status"
    },
    subject: {
      external_ref: {
        id: {
          _type: "GENERIC_ID",
          value: subjectId,
          scheme: "id_scheme"
        },
        namespace: "EHR",
        type: "PERSON"
      }
    },
    is_modifiable: true,
    is_queryable: true
  };

  const response = await axios.post(`${BASE_URL}/ehr`, ehrStatus, {
    headers: {
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
  });

  return response.data.ehr_id.value;
}

/**
 * Saves an assessment as a new composition in EHRbase.
 *
 * @param {string} ehrId - the patient's EHR ID (patient.ehrid)
 * @param {string} compositionXml - finished XML from buildCompositionXml()
 * @returns {Promise<{ uid: string, raw: object }>} uid = the composition's
 *   full version UID (e.g. "1234...::domain.example.com::1"), stored
 *   locally so the composition can later be fetched again or revoked (deleted).
 */
export async function createComposition(ehrId, compositionXml) {
  const response = await axios.post(
    `${BASE_URL}/ehr/${ehrId}/composition`,
    compositionXml,
    {
      headers: {
        "Content-Type": "application/xml",
        "Accept": "application/json",
        "Prefer": "return=representation",
      },
    }
  );

  const data = response.data;
  // With Accept: application/json, EHRbase returns the canonical JSON form
  // of the saved composition; the version UID lives in uid.value.
  // As a fallback, the ETag header is also checked, in case the server
  // (depending on configuration) only sets the header.
  const etag = response.headers?.etag?.replaceAll?.('"', '');
  const uid = data?.uid?.value ?? etag ?? null;

  if (!uid) {
    throw new Error('EHRbase did not return a composition UID.');
  }

  return { uid, raw: data };
}

/**
 * Loads a saved composition in FLAT format. FLAT works well for *reading*
 * here, since every value sits under a flat, self-descriptive path (unlike
 * writing, where we deliberately use canonical XML, see
 * CompositionXmlBuilder.js) — templateParser.groupFlatComposition() can
 * turn this format directly into a readable view matched against the template.
 *
 * @param {string} ehrId
 * @param {string} versionUid - full version UID of the composition
 * @returns {Promise<object>} flat { "path|suffix": value } object
 */
export async function getComposition(ehrId, versionUid) {
  const response = await axios.get(
    `${BASE_URL}/ehr/${ehrId}/composition/${encodeURIComponent(versionUid)}`,
    {
      params: { format: 'FLAT' },
      headers: { Accept: 'application/json' },
    }
  );

  const data = response.data;
  // Some EHRbase versions return the FLAT object directly, others wrap it
  // in { composition: {...} } — both cases are handled here.
  if (data && typeof data === 'object' && data.composition && typeof data.composition === 'object') {
    return data.composition;
  }
  return data;
}