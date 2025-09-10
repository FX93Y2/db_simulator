import React from 'react';
import ResultItem from './ResultItem';

const ResultsList = ({ 
  projectId,
  results, 
  expandedResults,
  resultTables,
  currentResultId,
  currentTable,
  isCompact,
  onToggleResultExpansion,
  onResultClick,
  onTableClick,
  onDeleteResultClick
}) => {
  if (!results || results.length === 0) {
    return (
      <div className="no-results">
        {isCompact ? 'No results' : 'No simulation results found'}
      </div>
    );
  }

  return (
    <div className="project-results-list">
      {results.map((result) => {
        const resultKey = `${projectId}-${result.id}`;
        const isExpanded = expandedResults[resultKey];
        const tables = resultTables[resultKey];
        // Only highlight result if no table is selected
        const isActive = currentResultId === result.id && !currentTable;
        
        return (
          <ResultItem
            key={result.id}
            result={result}
            projectId={projectId}
            isActive={isActive}
            isExpanded={isExpanded}
            tables={tables}
            currentTable={currentTable}
            isCompact={isCompact}
            onToggleExpansion={() => onToggleResultExpansion(projectId, result.id)}
            onResultClick={() => onResultClick(projectId, result.id)}
            onTableClick={(table) => onTableClick(projectId, result.id, table)}
            onDeleteClick={(e) => onDeleteResultClick(e, projectId, result)}
          />
        );
      })}
    </div>
  );
};

export default ResultsList;
