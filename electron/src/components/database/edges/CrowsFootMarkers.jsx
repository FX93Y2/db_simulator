import React from 'react';

/**
 * SVG Markers for Crow's Foot Notation
 * Defines markers for:
 * - One (vertical line)
 * - Many (crow's foot)
 * - Zero or One (circle + line)
 * - Zero or Many (circle + crow's foot)
 * - One and Only One (two lines)
 * 
 * Includes variants for:
 * - Default state (Grey: #b1b7c1)
 * - Selected state (Blue: #3498db)
 * 
 * Uses standard scaling (strokeWidth) for maximum compatibility,
 * but with tuned dimensions to ensure correct visual size.
 */
const CrowsFootMarkers = () => {
    const defaultColor = '#b1b7c1';
    const selectedColor = '#3498db'; // var(--theme-primary)

    // Calibrate size:
    // Edge stroke width is usually 2px.
    // We want the marker to be ~12-14px tall/wide.
    // With markerUnits="strokeWidth" (default), effective size = markerWidth * strokeWidth.
    // So if we want 12px, and strokeWidth is 2, we need markerWidth = 6.
    // ViewBox should match the logical drawing space.

    const markerSize = 6; // logical size multiplier
    const baseMarkerProps = {
        markerWidth: markerSize,
        markerHeight: markerSize,
        orient: "auto-start-reverse"
        // implicit markerUnits="strokeWidth"
    };

    const renderMarkerSet = (suffix, color) => (
        <>
            {/* Many (Crow's Foot) 
          ViewBox 12x12.
          RefX at 12 (right edge).
      */}
            <marker
                id={`crows-foot-many-${suffix}`}
                viewBox="0 0 12 12"
                refX={11} // Slight offset to ensure overlap with node
                refY={6}
                {...baseMarkerProps}
            >
                <path d="M0,6 L12,0 M0,6 L12,12 M0,6 L12,6" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>

            {/* One (Single Bar) */}
            <marker
                id={`crows-foot-one-${suffix}`}
                viewBox="0 0 12 12"
                refX={11}
                refY={6}
                {...baseMarkerProps}
            >
                <path d="M11,0 L11,12" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            </marker>

            {/* One and Only One (Double Bar) */}
            <marker
                id={`crows-foot-one-and-only-one-${suffix}`}
                viewBox="0 0 16 12"
                refX={15}
                refY={6}
                {...baseMarkerProps}
                markerWidth={8} // Needs to be wider
            >
                <path d="M15,0 L15,12 M9,0 L9,12" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            </marker>

            {/* Zero or One (Circle + Bar) */}
            <marker
                id={`crows-foot-zero-or-one-${suffix}`}
                viewBox="0 0 18 12"
                refX={17}
                refY={6}
                {...baseMarkerProps}
                markerWidth={9} // Wider
            >
                <circle cx={7} cy={6} r={4} fill="var(--theme-card-bg, #ffffff)" stroke={color} strokeWidth="1.5" />
                <path d="M17,0 L17,12" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            </marker>

            {/* Zero or Many (Circle + Crow's Foot) */}
            <marker
                id={`crows-foot-zero-or-many-${suffix}`}
                viewBox="0 0 18 12"
                refX={17}
                refY={6}
                {...baseMarkerProps}
                markerWidth={9} // Wider
            >
                <circle cx={7} cy={6} r={4} fill="var(--theme-card-bg, #ffffff)" stroke={color} strokeWidth="1.5" />
                <path d="M8,6 L17,0 M8,6 L17,12 M8,6 L17,6" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
        </>
    );

    return (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
                {renderMarkerSet('default', defaultColor)}
                {renderMarkerSet('selected', selectedColor)}
            </defs>
        </svg>
    );
};

export default CrowsFootMarkers;
