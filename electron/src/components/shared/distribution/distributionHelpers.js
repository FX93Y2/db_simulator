/**
 * Utility functions for distribution handling
 */

/**
 * Validates a distribution formula string
 * @param {string} formula - The distribution formula to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export const validateDistributionFormula = (formula) => {
  if (!formula || typeof formula !== 'string') {
    return { valid: false, error: 'Formula is required' };
  }

  const trimmed = formula.trim();
  if (!trimmed) {
    return { valid: false, error: 'Formula cannot be empty' };
  }

  // Basic syntax check for distribution pattern: NAME(params)
  const distributionPattern = /^[A-Z]+\s*\([^)]*\)$/;
  if (!distributionPattern.test(trimmed)) {
    return { valid: false, error: 'Invalid formula syntax. Expected format: DIST(params)' };
  }

  // Extract distribution name
  const nameMatch = trimmed.match(/^([A-Z]+)/);
  if (!nameMatch) {
    return { valid: false, error: 'Distribution name must be uppercase letters' };
  }

  const distName = nameMatch[1];
  const supportedDistributions = [
    'UNIF', 'NORM', 'EXPO', 'TRIA', 'BETA', 'GAMA', 'ERLA', 
    'LOGN', 'WEIB', 'DISC', 'POIS', 'RAND', 'FIXED'
  ];

  if (!supportedDistributions.includes(distName)) {
    return { 
      valid: false, 
      error: `Unsupported distribution '${distName}'. Supported: ${supportedDistributions.join(', ')}` 
    };
  }

  return { valid: true, error: null };
};

/**
 * Converts old distribution object format to formula format
 * @param {Object} distributionObj - Old format distribution object
 * @returns {string} - Formula string
 */
export const convertDistributionToFormula = (distributionObj) => {
  if (!distributionObj || typeof distributionObj !== 'object') {
    return '';
  }

  const { type } = distributionObj;
  
  switch (type) {
    case 'uniform':
      return `UNIF(${distributionObj.min || 0}, ${distributionObj.max || 1})`;
    
    case 'normal':
      return `NORM(${distributionObj.mean || 0}, ${distributionObj.stddev || 1})`;
    
    case 'exponential':
      return `EXPO(${distributionObj.scale || 1})`;
    
    case 'triangular':
      return `TRIA(${distributionObj.min || 0}, ${distributionObj.mode || 0.5}, ${distributionObj.max || 1})`;
    
    case 'beta':
      const min = distributionObj.min || 0;
      const max = distributionObj.max || 1;
      const shape1 = distributionObj.shape1 || 2;
      const shape2 = distributionObj.shape2 || 2;
      return `BETA(${min}, ${max}, ${shape1}, ${shape2})`;
    
    case 'gamma':
      return `GAMA(${distributionObj.alpha || 2}, ${distributionObj.beta || 1})`;
    
    case 'erlang':
      return `ERLA(${distributionObj.mean || 1}, ${distributionObj.k || 2})`;
    
    case 'lognormal':
      return `LOGN(${distributionObj.mean || 0}, ${distributionObj.sigma || 1})`;
    
    case 'weibull':
      return `WEIB(${distributionObj.alpha || 1}, ${distributionObj.beta || 1})`;
    
    case 'poisson':
      return `POIS(${distributionObj.lambda || distributionObj.lam || 1})`;
    
    case 'choice':
    case 'discrete':
      if (distributionObj.values && distributionObj.weights) {
        const pairs = [];
        for (let i = 0; i < distributionObj.values.length; i++) {
          const value = distributionObj.values[i];
          const weight = distributionObj.weights[i] || 0;
          const valueStr = typeof value === 'string' ? `"${value}"` : value;
          pairs.push(`${weight}, ${valueStr}`);
        }
        return `DISC(${pairs.join(', ')})`;
      }
      return 'DISC(1, 0)';
    
    case 'fixed':
      return `FIXED(${distributionObj.value || 0})`;
    
    case 'rand':
    case 'random':
      return 'RAND()';
    
    default:
      return '';
  }
};

/**
 * Gets a default formula for common use cases
 * @param {string} context - Context like 'interarrival', 'duration', 'attribute'
 * @returns {string} - Default formula
 */
export const getDefaultFormula = (context = 'general') => {
  switch (context) {
    case 'interarrival':
      return 'EXPO(2)';
    case 'duration':
      return 'NORM(5, 1)';
    case 'attribute':
      return 'UNIF(1, 10)';
    case 'discrete':
      return 'DISC(0.7, "A", 0.3, "B")';
    default:
      return 'UNIF(0, 1)';
  }
};