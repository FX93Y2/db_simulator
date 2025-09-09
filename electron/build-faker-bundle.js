/**
 * Build script to create a standalone Faker.js bundle for PyMiniRacer
 * This creates a self-contained JavaScript file that can be loaded in V8
 */

const fs = require('fs');
const path = require('path');

// Read the Faker.js package
const fakerPath = require.resolve('@faker-js/faker');
const fakerDir = path.dirname(fakerPath);

// Create a simple bundle that exposes faker globally
const bundleContent = `
// Faker.js Bundle for PyMiniRacer
(function(global) {
    // Import Faker.js
    const { faker } = require('@faker-js/faker');
    
    // Expose faker globally for PyMiniRacer
    global.faker = faker;
    
    // Helper function for dotted path resolution
    global.generateFake = function(method) {
        try {
            const parts = method.split('.');
            let obj = faker;
            
            for (const part of parts) {
                if (!obj || typeof obj !== 'object') {
                    throw new Error(\`Cannot access '\${part}' in method '\${method}'\`);
                }
                
                obj = obj[part];
                
                if (obj === undefined) {
                    throw new Error(\`Method not found: \${method}\`);
                }
            }
            
            // If it's a function, call it; otherwise return the value
            return typeof obj === 'function' ? obj() : obj;
        } catch (error) {
            throw new Error(\`Faker.js error for '\${method}': \${error.message}\`);
        }
    };
    
    // Test function to verify the bundle works
    global.testFaker = function() {
        return {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            bookTitle: faker.book ? faker.book.title() : 'Book module available',
            version: faker.version || '10.0.0'
        };
    };
    
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;

// For PyMiniRacer, we need to use webpack to create a proper bundle
// Let's create a webpack config and build script
const webpack = require('webpack');
const webpackConfig = {
    mode: 'production',
    entry: path.resolve(__dirname, 'faker-entry.js'),
    output: {
        path: path.resolve(__dirname, '..', 'python', 'src', 'generator', 'data', 'faker_js'),
        filename: 'bundle.js',
        library: {
            type: 'var',
            name: 'FakerBundle'
        }
    },
    target: 'node',
    resolve: {
        fallback: {
            "crypto": false,
            "stream": false,
            "path": false,
            "fs": false
        }
    }
};

// First create the entry file
const entryContent = `
const { faker } = require('@faker-js/faker');

// Expose faker and helper functions globally
if (typeof globalThis !== 'undefined') {
    globalThis.faker = faker;
} else if (typeof window !== 'undefined') {
    window.faker = faker;
} else if (typeof global !== 'undefined') {
    global.faker = faker;
}

// Helper function for PyMiniRacer
const generateFake = function(method) {
    try {
        const parts = method.split('.');
        let obj = faker;
        
        for (const part of parts) {
            if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
                throw new Error(\`Cannot access '\${part}' in method '\${method}'\`);
            }
            
            obj = obj[part];
            
            if (obj === undefined) {
                throw new Error(\`Method '\${method}' not found\`);
            }
        }
        
        // If it's a function, call it; otherwise return the value
        return typeof obj === 'function' ? obj() : obj;
    } catch (error) {
        return \`Unsupported Faker Method: \${method} (\${error.message})\`;
    }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { faker, generateFake };
}

// Also expose generateFake globally
if (typeof globalThis !== 'undefined') {
    globalThis.generateFake = generateFake;
} else if (typeof window !== 'undefined') {
    window.generateFake = generateFake;
} else if (typeof global !== 'undefined') {
    global.generateFake = generateFake;
}
`;

// Write the entry file
fs.writeFileSync(path.resolve(__dirname, 'faker-entry.js'), entryContent);

// Run webpack
webpack(webpackConfig, (err, stats) => {
    if (err || stats.hasErrors()) {
        console.error('Build failed:', err || stats.toString());
        process.exit(1);
    }
    
    console.log('Faker.js bundle created successfully!');
    console.log('Output:', path.resolve(__dirname, '..', 'python', 'src', 'generator', 'data', 'faker_js', 'bundle.js'));
    
    // Clean up the entry file
    fs.unlinkSync(path.resolve(__dirname, 'faker-entry.js'));
});