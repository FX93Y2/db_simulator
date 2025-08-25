/**
 * Distribution Help Content
 * Migrated from DistributionHelpPanel
 */

export const getDistributionHelp = () => ({
  description: 'Statistical distributions for generating random values. All distributions are inclusive of their bounds.',
  
  categories: {
    continuous: {
      title: 'Continuous Distributions',
      items: [
        {
          syntax: 'UNIF(min, max)',
          description: 'Uniform distribution between min and max (inclusive)',
          example: 'UNIF(1, 10)'
        },
        {
          syntax: 'NORM(mean, stddev)',
          description: 'Normal (Gaussian) distribution',
          example: 'NORM(5, 1.5)'
        },
        {
          syntax: 'EXPO(scale)',
          description: 'Exponential distribution',
          example: 'EXPO(2)'
        },
        {
          syntax: 'TRIA(min, mode, max)',
          description: 'Triangular distribution',
          example: 'TRIA(1, 5, 10)'
        },
        {
          syntax: 'BETA(min, max, shape1, shape2)',
          description: 'Beta distribution scaled to range [min, max]',
          example: 'BETA(0, 1, 2, 3)'
        },
        {
          syntax: 'GAMA(alpha, beta)',
          description: 'Gamma distribution',
          example: 'GAMA(2, 1.5)'
        },
        {
          syntax: 'ERLA(mean, k)',
          description: 'Erlang distribution',
          example: 'ERLA(5, 3)'
        },
        {
          syntax: 'LOGN(mean, sigma)',
          description: 'Lognormal distribution',
          example: 'LOGN(1, 0.5)'
        },
        {
          syntax: 'WEIB(alpha, beta)',
          description: 'Weibull distribution',
          example: 'WEIB(1.5, 2)'
        }
      ]
    },
    
    discrete: {
      title: 'Discrete Distributions',
      items: [
        {
          syntax: 'DISC(p1, v1, p2, v2, ...)',
          description: 'Discrete distribution with probability-value pairs',
          example: 'DISC(0.7, "simple", 0.3, "complex")'
        },
        {
          syntax: 'POIS(lambda)',
          description: 'Poisson distribution',
          example: 'POIS(3.5)'
        }
      ]
    },
    
    special: {
      title: 'Special Functions',
      items: [
        {
          syntax: 'RAND()',
          description: 'Uniform random number between 0 and 1',
          example: 'RAND()'
        }
      ]
    }
  },
  
  notes: [
    'All distributions use inclusive bounds where applicable',
    'UNIF(1, 10) can generate values 1, 2, 3, ..., 10',
    'DISC probabilities must sum to 1.0',
    'Negative values are allowed for most distributions',
    'Use parentheses and commas exactly as shown'
  ]
});