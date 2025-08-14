import React from 'react';
import { VscEmptyWindow } from 'react-icons/vsc';
import { LuUndo2, LuRedo2 } from 'react-icons/lu';

/**
 * Database Configuration Editor Toolbar Configuration
 * Extracted from DbConfigEditor to reduce component bloat
 */
export const getDbToolbarItems = ({
  handleAddTable,
  undo,
  redo,
  canUndo,
  canRedo,
  isLoading
}) => [
  {
    type: 'button',
    icon: <VscEmptyWindow />,
    onClick: handleAddTable,
    disabled: isLoading,
    variant: 'primary',
    tooltip: 'Add Table'
  },
  {
    type: 'separator'
  },
  {
    type: 'button',
    icon: <LuUndo2 />,
    onClick: undo,
    disabled: isLoading || !canUndo(),
    variant: 'primary',
    tooltip: 'Undo'
  },
  {
    type: 'button',
    icon: <LuRedo2 />,
    onClick: redo,
    disabled: isLoading || !canRedo(),
    variant: 'primary',
    tooltip: 'Redo'
  }
];