import React from 'react';
import { LuUndo2, LuRedo2, LuMousePointer, LuSettings, LuPlay } from 'react-icons/lu';

/**
 * Simulation Configuration Editor Toolbar Configuration
 * Extracted from SimConfigEditor to reduce component bloat
 */
export const getSimToolbarItems = ({
  setShowSimulationModal,
  setShowRunModal,
  toggleSelectionMode,
  selectionMode,
  undo,
  redo,
  canUndo,
  canRedo,
  isLoading
}) => [
  {
    type: 'button',
    icon: <LuMousePointer />,
    onClick: toggleSelectionMode,
    disabled: isLoading,
    variant: selectionMode ? 'active' : 'primary',
    tooltip: selectionMode ? 'Switch to Pan Mode' : 'Switch to Selection Mode'
  },
  {
    type: 'separator'
  },
  {
    type: 'button',
    icon: <LuSettings />,
    onClick: () => setShowSimulationModal(true),
    disabled: isLoading,
    variant: 'primary',
    tooltip: 'Simulation Setup'
  },
  {
    type: 'button',
    icon: <LuPlay />,
    onClick: () => setShowRunModal(true),
    disabled: isLoading,
    variant: 'primary',
    tooltip: 'Run Simulation'
  },
  {
    type: 'separator'
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