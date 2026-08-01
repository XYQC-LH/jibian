const coreWebVitals = require('eslint-config-next/core-web-vitals');

module.exports = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  },
  ...coreWebVitals,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}', 'tests/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSTypeReference[typeName.name="Record"] TSTypeParameterInstantiation TSAnyKeyword',
          message: 'Record<string, any> 禁止使用。请改用 Record<string, unknown>，或在行末加 eslint-disable-next-line 豁免。',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@shared-types',
              message: '请改为 @/lib/api-clients/types。',
            },
          ],
          patterns: [
            {
              group: [
                '../shared',
                '../shared/*',
                '../../shared',
                '../../shared/*',
                '../../../shared',
                '../../../shared/*',
                '../../../../shared',
                '../../../../shared/*',
                '../../../../../shared',
                '../../../../../shared/*',
              ],
              message: '请改为 @/lib/api-clients/*。',
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];
