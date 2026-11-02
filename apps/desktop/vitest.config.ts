import { defineProject } from 'vitest/config';

export default defineProject({ define: { __TEST_HOOKS__: 'false' }, test: { name: 'desktop', include: ['test/**/*.test.ts'] } });
