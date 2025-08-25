/**
 * Formula Expression Help Content
 * Migrated from FormulaHelpPanel
 */

export const getFormulaHelp = () => ({
  description: 'Formula expressions execute after simulation completion when all referenced data exists. Use @column_name to reference current row values.',
  
  categories: {
    queries: {
      title: 'SQL Aggregate Functions',
      items: [
        {
          syntax: 'MIN(SELECT column FROM table WHERE condition)',
          description: 'Get minimum value from query',
          example: 'MIN(SELECT created_at FROM Tickets WHERE user_id = @id)'
        },
        {
          syntax: 'MAX(SELECT column FROM table WHERE condition)',
          description: 'Get maximum value from query',
          example: 'MAX(SELECT updated_at FROM Orders WHERE customer_id = @id)'
        },
        {
          syntax: 'AVG(SELECT column FROM table WHERE condition)',
          description: 'Calculate average value',
          example: 'AVG(SELECT price FROM Products WHERE category_id = @id)'
        },
        {
          syntax: 'COUNT(SELECT * FROM table WHERE condition)',
          description: 'Count matching records',
          example: 'COUNT(SELECT * FROM Reviews WHERE product_id = @id)'
        },
        {
          syntax: 'SUM(SELECT column FROM table WHERE condition)',
          description: 'Sum values from query',
          example: 'SUM(SELECT amount FROM Payments WHERE user_id = @id)'
        }
      ]
    },
    
    dates: {
      title: 'Date/Time Functions',
      items: [
        {
          syntax: 'expression ± DAYS(n)',
          description: 'Add or subtract days from date',
          example: 'created_at - DAYS(30)'
        },
        {
          syntax: 'expression ± HOURS(n)',
          description: 'Add or subtract hours',
          example: 'timestamp + HOURS(2)'
        },
        {
          syntax: 'expression ± MINUTES(n)',
          description: 'Add or subtract minutes',
          example: 'start_time - MINUTES(15)'
        }
      ]
    },
    
    variables: {
      title: 'Variables & Random',
      items: [
        {
          syntax: 'RANDOM(min, max)',
          description: 'Random integer between min and max',
          example: 'DAYS(RANDOM(30, 365))'
        },
        {
          syntax: '@column_name',
          description: 'Reference any column from current row',
          example: '@id, @user_id, @category_name'
        }
      ]
    },
    
    patterns: {
      title: 'Common Patterns',
      items: [
        {
          syntax: 'MIN(...) - DAYS(RANDOM(...))',
          description: 'User registered before first activity',
          example: 'MIN(SELECT created_at FROM Activities WHERE user_id = @id) - DAYS(RANDOM(30, 365))'
        },
        {
          syntax: 'SUM/COUNT/AVG(...)',
          description: 'Calculate summary statistics',
          example: 'SUM(SELECT amount FROM Purchases WHERE customer_id = @id)'
        },
        {
          syntax: 'expression * multiplier',
          description: 'Apply calculations and markups',
          example: 'AVG(SELECT price FROM Products WHERE category_id = @id) * 1.2'
        },
        {
          syntax: 'COUNT(...WHERE condition)',
          description: 'Count records meeting criteria',
          example: 'COUNT(SELECT * FROM Tickets WHERE user_id = @id AND priority = \'high\')'
        }
      ]
    }
  },
  
  notes: [
    'Formulas execute after simulation completion',
    'Must return a single scalar value (not multiple rows)',
    'NULL results are preserved (no defaults applied)',
    'Only reference columns from current row using @column_name',
    'No recursive formulas (can\'t reference own column)'
  ]
});