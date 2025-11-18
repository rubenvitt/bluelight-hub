module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/domain/**/*.spec.ts', '**/infrastructure/**/*.spec.ts', '**/application/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: 'es2021',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    // Transform ESM modules (nanoid) in node_modules
    'node_modules/(?!(nanoid)/)',
  ],
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
  },
  collectCoverageFrom: ['src/domain/**/*.ts', '!src/domain/**/*.spec.ts'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '\\.example\\.ts$', // Example files - not production code
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
