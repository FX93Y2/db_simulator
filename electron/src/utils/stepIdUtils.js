/**
 * Utility functions for working with step_id formats
 */

/**
 * Extracts display name from step_id format
 * Converts: event_professional_assignment_1 → "Professional Assignment"
 * Format: {type}_{display_name}_{counter} → "Display Name"
 * 
 * @param {string} stepId - The step ID in format: type_display_name_counter
 * @returns {string} - The extracted display name in Title Case
 */
export const extractDisplayNameFromStepId = (stepId) => {
  if (!stepId || typeof stepId !== 'string') {
    return '';
  }

  // Split by underscore
  const parts = stepId.split('_');
  
  // Need at least 3 parts: type, name part(s), counter
  if (parts.length < 3) {
    return stepId; // Return original if format doesn't match
  }

  // Remove first part (type) and last part (counter)
  // The middle part(s) form the display name
  const nameParts = parts.slice(1, -1);
  
  // Convert to title case and join with spaces
  const displayName = nameParts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
  
  return displayName;
};

/**
 * Converts display name to step_id compatible format
 * Converts: "Professional Assignment" → "professional_assignment"
 * 
 * @param {string} displayName - The display name to convert
 * @returns {string} - The converted name for use in step_id
 */
export const convertDisplayNameToStepIdFormat = (displayName) => {
  if (!displayName || typeof displayName !== 'string') {
    return '';
  }

  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
    .trim()
    .replace(/\s+/g, '_'); // Replace spaces with underscores
};

/**
 * Generates a step_id from type, display name, and counter
 * 
 * @param {string} stepType - The step type (event, decide, assign, etc.)
 * @param {string} displayName - The display name
 * @param {number} counter - The counter number
 * @returns {string} - The generated step_id
 */
export const generateStepIdFromParts = (stepType, displayName, counter = 1) => {
  const nameForId = convertDisplayNameToStepIdFormat(displayName);
  return `${stepType}_${nameForId}_${counter}`;
};