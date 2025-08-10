/**
 * Utility functions for step_id generation
 * Note: Display name extraction functions were removed in favor of dual naming system
 */

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