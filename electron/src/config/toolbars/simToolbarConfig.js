import React from 'react';
import { FiSettings, FiGitBranch, FiTag, FiPlay } from 'react-icons/fi';
import { VscEmptyWindow } from 'react-icons/vsc';
import { LuUndo2, LuRedo2, LuPackage, LuCalendar, LuMousePointer } from 'react-icons/lu';

/**
 * Simulation Configuration Editor Toolbar Configuration
 * Extracted from SimConfigEditor to reduce component bloat
 */
export const getSimToolbarItems = ({
  handleAddModule,
  setShowResourceModal,
  setShowSimulationModal,
  toggleSelectionMode,
  selectionMode,
  undo,
  redo,
  canUndo,
  canRedo,
  isLoading
}) => [
  {
    type: 'dropdown',
    icon: <VscEmptyWindow />,
    disabled: isLoading,
    variant: 'primary',
    tooltip: 'Add Module',
    dropDirection: 'end',
    children: [
      {
        icon: <VscEmptyWindow />,
        label: 'Create',
        onClick: () => handleAddModule('create')
      },
      {
        icon: <FiSettings />,
        label: 'Process (Event)',
        onClick: () => handleAddModule('event')
      },
      {
        icon: <FiGitBranch />,
        label: 'Decide',
        onClick: () => handleAddModule('decide')
      },
      {
        icon: <FiTag />,
        label: 'Assign',
        onClick: () => handleAddModule('assign')
      },
      {
        icon: <FiPlay />,
        label: 'Release (Dispose)',
        onClick: () => handleAddModule('release')
      }
    ]
  },
  {
    type: 'separator'
  },
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
    icon: <LuPackage />,
    onClick: () => setShowResourceModal(true),
    disabled: isLoading,
    variant: 'primary',
    tooltip: 'Resource Capacity Config'
  },
  {
    type: 'button',
    icon: <LuCalendar />,
    onClick: () => setShowSimulationModal(true),
    disabled: isLoading,
    variant: 'primary',
    tooltip: 'Simulation Duration Config'
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