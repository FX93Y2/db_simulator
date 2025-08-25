/**
 * Termination Conditions Help Content
 * Based on TERMINATION_CONDITIONS.md documentation
 */

export const getTerminationConditionsHelp = () => ({
  description: 'Termination conditions determine when a simulation should stop running. Use formulas to specify complex stopping criteria based on time, entity counts, or event counts.',
  
  categories: {
    timeBased: {
      title: 'Time-Based Functions',
      items: [
        {
          syntax: 'TIME(value)',
          description: 'Stop simulation when time reaches value (in base time units)',
          example: 'TIME(720)  // Stop after 720 hours'
        }
      ]
    },
    
    entityBased: {
      title: 'Entity-Based Functions',
      items: [
        {
          syntax: 'ENTITIES(table, count)',
          description: 'Stop when specified number of entities created in table',
          example: 'ENTITIES(Order, 1000)  // Stop after 1000 orders'
        },
        {
          syntax: 'ENTITIES(*, count)',
          description: 'Stop when total entities across all tables reaches count',
          example: 'ENTITIES(*, 2000)  // Stop after 2000 total entities'
        }
      ]
    },
    
    eventBased: {
      title: 'Event-Based Functions',
      items: [
        {
          syntax: 'EVENTS(count)',
          description: 'Stop when total number of events processed reaches count',
          example: 'EVENTS(10000)  // Stop after 10,000 events'
        },
        {
          syntax: 'EVENTS(table, count)',
          description: 'Stop when specific event table reaches count',
          example: 'EVENTS(Order_Event, 5000)  // Stop after 5,000 order events'
        }
      ]
    },
    
    operators: {
      title: 'Logical Operators',
      items: [
        {
          syntax: 'condition AND condition',
          description: 'Both conditions must be true for termination',
          example: 'ENTITIES(Order, 1000) AND TIME(480)'
        },
        {
          syntax: 'condition OR condition',
          description: 'Either condition can trigger termination',
          example: 'TIME(720) OR ENTITIES(Order, 1000)'
        },
        {
          syntax: '(condition) AND/OR (condition)',
          description: 'Use parentheses to group conditions and control evaluation',
          example: '(ENTITIES(Order, 1000) OR ENTITIES(Customer, 500)) AND TIME(480)'
        }
      ]
    },
    
    patterns: {
      title: 'Common Patterns',
      items: [
        {
          syntax: 'Daily Operations',
          description: 'Run for a full workday',
          example: 'TIME(8)  // 8 hours with base_time_unit: hours'
        },
        {
          syntax: 'Capacity-Based',
          description: 'Stop when production quota reached or time limit',
          example: 'ENTITIES(Product, 1000) OR TIME(480)'
        },
        {
          syntax: 'Multi-Location',
          description: 'Stop when any location reaches capacity',
          example: 'ENTITIES(Store1Order, 100) OR ENTITIES(Store2Order, 150)'
        },
        {
          syntax: 'Time-Bounded with Limits',
          description: 'Run full duration but stop early if limit reached',
          example: 'TIME(1440) OR ENTITIES(Patient, 200)'
        }
      ]
    }
  },
  
  notes: [
    'Formulas are case-sensitive (use uppercase function names)',
    'TIME values are in your configured base_time_unit',
    'Entity and event counts are cumulative since simulation start',
    'OR conditions evaluate left to right, stopping at first true condition',
    'AND conditions evaluate left to right, stopping at first false condition',
    'Use parentheses for complex logical expressions',
    'If formula has errors, simulation uses TIME(999999) as fallback'
  ]
});