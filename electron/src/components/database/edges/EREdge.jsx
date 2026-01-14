import React from 'react';
import { BaseEdge, getSmoothStepPath, Position } from 'reactflow';

/**
 * Custom ER Diagram Edge with Direct SVG Shape Rendering
 * 
 * Instead of relying on <marker> definitions, this renders SVG paths directly.
 * 
 * IMPORTANT: Shapes are defined facing RIGHT (+X).
 * (0,0) is the Node Handle.
 * Positive X extends OUTWARDS from the node into the diagram.
 * The rotation logic then orients this +X vector to the correct handle direction.
 */

const getRotation = (position) => {
    switch (position) {
        case Position.Top: return -90;
        case Position.Right: return 0;
        case Position.Bottom: return 90;
        case Position.Left: return 180;
        default: return 0;
    }
};

const Shapes = {
    // Many: Crow's Foot
    'crows-foot-many': (color) => (
        <path
            d="M0,-6 L12,0 M0,6 L12,0 M0,0 L12,0"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    ),

    // One: Single Bar
    'crows-foot-one': (color) => (
        <path
            d="M8,-6 L8,6"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    ),

    // One and Only One: Double Bar
    'crows-foot-one-and-only-one': (color) => (
        <>
            <path d="M6,-6 L6,6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12,-6 L12,6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
    ),

    // Zero or One: Circle + Bar
    'crows-foot-zero-or-one': (color) => (
        <>
            <circle cx={6} cy={0} r={4} fill="var(--theme-card-bg, #ffffff)" stroke={color} strokeWidth="1.5" />
            <path d="M12,-6 L12,6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
    ),

    // Zero or Many: Circle + Crow's Foot
    'crows-foot-zero-or-many': (color) => (
        <>
            <circle cx={6} cy={0} r={4} fill="var(--theme-card-bg, #ffffff)" stroke={color} strokeWidth="1.5" />
            {/* Crow's foot part, shifted out */}
            <path d="M8,-6 L16,0 M8,6 L16,0 M10,0 L16,0" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
    )
};

const EREdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    markerStart,
    data, // Receive the data object
    selected,
    interactionWidth = 20
}) => {
    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const color = selected ? 'var(--theme-primary, #3498db)' : (style.stroke || '#b1b7c1');
    const strokeWidth = selected ? 3 : 2;

    // Helper to extract marker type string if object
    const getMarkerType = (propValue, dataValue) => {
        // Prefer data value if present, as it escapes ReactFlow filtering
        if (dataValue) return dataValue;

        if (!propValue) return null;
        if (typeof propValue === 'string') return propValue.replace('-default', '').replace('-selected', '');
        return propValue.type ? propValue.type.replace('-default', '').replace('-selected', '') : null;
    };

    const startType = getMarkerType(markerStart, data?.markerStartType) || 'crows-foot-many'; // Fallback to force visibility for now
    const endType = getMarkerType(markerEnd, data?.markerEndType) || 'crows-foot-one';     // Fallback to force visibility for now

    const renderMarker = (x, y, position, type) => {
        const Shape = Shapes[type];
        if (!Shape) {
            console.warn(`[EREdge] Check failed: Unknown shape type ${type}`);
            return null;
        }

        const rotation = getRotation(position);

        return (
            <g transform={`translate(${x},${y}) rotate(${rotation})`}>
                {Shape(color)}
                {/* Debug Circle: Verify 0,0 is where we think it is */}
                {/* <circle cx={0} cy={0} r={2} fill="red" /> */}
            </g>
        );
    };

    return (
        <>
            <BaseEdge
                path={edgePath}
                id={id}
                style={{
                    ...style,
                    strokeWidth,
                    stroke: color,
                    cursor: 'pointer'
                }}
                interactionWidth={interactionWidth}
            />
            {renderMarker(sourceX, sourceY, sourcePosition, startType)}
            {renderMarker(targetX, targetY, targetPosition, endType)}
        </>
    );
};

export default EREdge;
