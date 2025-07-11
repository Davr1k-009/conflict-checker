// backend/src/utils/jsonUtils.js

/**
 * Safely parse JSON string with fallback to default value
 * @param {string|Object} jsonString - JSON string to parse or already parsed object
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed object or default value
 */
const safeJsonParse = (jsonString, defaultValue = null) => {
  try {
    // If it's already an object/array, return it as is
    if (typeof jsonString === 'object' && jsonString !== null) {
      return jsonString;
    }
    
    // Check if the string is null, undefined, or empty
    if (!jsonString || (typeof jsonString === 'string' && jsonString.trim() === '')) {
      return defaultValue;
    }
    
    // Attempt to parse if it's a string
    if (typeof jsonString === 'string') {
      return JSON.parse(jsonString);
    }
    
    // For any other type, return default value
    return defaultValue;
  } catch (error) {
    console.warn('Failed to parse JSON:', error.message, 'Input:', jsonString);
    return defaultValue;
  }
};

/**
 * Parse case JSON fields safely
 * @param {Object} caseData - Case object from database
 * @returns {Object} Case object with parsed JSON fields
 */
const parseCaseJsonFields = (caseData) => {
  return {
    ...caseData,
    // Add default values for new type fields
    client_type: caseData.client_type || 'legal',
    client_pinfl: caseData.client_pinfl || '',
    opponent_type: caseData.opponent_type || 'legal',
    opponent_pinfl: caseData.opponent_pinfl || '',
    // Parse JSON fields
    related_companies: safeJsonParse(caseData.related_companies, []),
    related_individuals: safeJsonParse(caseData.related_individuals, []),
    founders: safeJsonParse(caseData.founders, []),
    directors: safeJsonParse(caseData.directors, []),
    beneficiaries: safeJsonParse(caseData.beneficiaries, [])
  };
};

/**
 * Parse user permissions safely
 * @param {string|Object} permissions - Permissions JSON string or object
 * @returns {Object} Parsed permissions object
 */
const parsePermissions = (permissions) => {
  const defaultPermissions = { create: false, edit: false, delete: false };
  
  if (!permissions) {
    return defaultPermissions;
  }
  
  if (typeof permissions === 'object') {
    return { ...defaultPermissions, ...permissions };
  }
  
  return safeJsonParse(permissions, defaultPermissions);
};

module.exports = {
  safeJsonParse,
  parseCaseJsonFields,
  parsePermissions
};