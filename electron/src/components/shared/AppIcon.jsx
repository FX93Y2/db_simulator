import React from 'react';

const AppIcon = ({ width = 120, height = 122, className = '' }) => {
    // SVG ViewBox is 0 0 167 170. Adjusted default size to maintain aspect ratio.
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 167 170"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <path
                d="M32 84H109"
                style={{ stroke: 'var(--app-icon-blue-medium)' }}
                strokeWidth="4"
            />
            <g filter="url(#filter0_d_11_2)">
                <path
                    d="M147.356 15.2793C155.996 15.2793 163 22.2833 163 30.9229C163 39.5623 155.996 46.5664 147.356 46.5664H84.5645C73.3856 29.3108 54.851 17.4281 33.5039 15.543C34.4349 15.3702 35.395 15.2793 36.376 15.2793H147.356Z"
                    style={{ fill: 'var(--app-icon-blue-light)' }}
                />
            </g>
            <g filter="url(#filter1_d_11_2)">
                <path
                    d="M147.356 69.1211C155.996 69.1211 163 76.1251 163 84.7646C163 93.4042 155.996 100.408 147.356 100.408H95.4902C95.4902 100.408 97.2285 90.1438 97.2285 84.7646C97.2285 79.3854 96.6269 74.1491 95.4902 69.1211H147.356Z"
                    style={{ fill: 'var(--app-icon-blue-medium)' }}
                />
            </g>
            <g filter="url(#filter2_d_11_2)">
                <path
                    d="M147.356 122.964C155.996 122.964 163 129.967 163 138.606C163 147.246 155.996 154.25 147.356 154.25H36.376C35.5553 154.25 34.7494 154.185 33.9629 154.063C55.7181 152.458 74.6472 140.48 85.9951 122.964H147.356Z"
                    style={{ fill: 'var(--app-icon-blue-dark)' }}
                />
            </g>
            <path
                d="M22.7088 83.2024L22.7091 54.4624C22.7091 41.3748 33.1247 30.8156 46.0344 30.8156L91.3402 30.8155"
                style={{ stroke: 'var(--app-icon-blue-light)' }}
                strokeWidth="4"
            />
            <path
                d="M22.7088 86.7976L22.7091 115.538C22.7091 128.625 33.1247 139.184 46.0344 139.184L91.3402 139.184"
                style={{ stroke: 'var(--app-icon-blue-dark)' }}
                strokeWidth="4"
            />
            <g filter="url(#filter3_d_11_2)">
                <ellipse
                    cx="148.344"
                    cy="84.7647"
                    rx="5.36184"
                    ry="5.45696"
                    style={{ fill: 'var(--app-icon-accent)' }}
                />
            </g>
            <g filter="url(#filter4_d_11_2)">
                <ellipse
                    cx="148.344"
                    cy="138.607"
                    rx="5.36184"
                    ry="5.45696"
                    style={{ fill: 'var(--app-icon-accent)' }}
                />
            </g>
            <g filter="url(#filter5_d_11_2)">
                <ellipse
                    cx="148.344"
                    cy="30.9227"
                    rx="5.36184"
                    ry="5.45696"
                    style={{ fill: 'var(--app-icon-accent)' }}
                />
            </g>
            <g filter="url(#filter6_d_11_2)">
                <rect
                    x="13"
                    y="73"
                    width="21"
                    height="23"
                    rx="5"
                    style={{ fill: 'var(--app-icon-blue-medium)' }}
                />
            </g>
            <defs>
                {[0, 1, 2, 3, 4, 5, 6].map((id) => (
                    <filter
                        key={id}
                        id={`filter${id}_d_11_2`}
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                        filterUnits="objectBoundingBox"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix
                            in="SourceAlpha"
                            type="matrix"
                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                            result="hardAlpha"
                        />
                        <feOffset dy="4" />
                        <feGaussianBlur stdDeviation="2" />
                        <feComposite in2="hardAlpha" operator="out" />
                        <feColorMatrix
                            type="matrix"
                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                        />
                        <feBlend
                            mode="normal"
                            in2="BackgroundImageFix"
                            result="effect1_dropShadow_11_2"
                        />
                        <feBlend
                            mode="normal"
                            in="SourceGraphic"
                            in2="effect1_dropShadow_11_2"
                            result="shape"
                        />
                    </filter>
                ))}
            </defs>
        </svg>
    );
};

export default AppIcon;
