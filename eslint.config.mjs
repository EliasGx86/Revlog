// ESLint 9 flat config — Next 16 removed `next lint`, so the `lint` script
// runs eslint directly against this.
import coreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...coreWebVitals,
  {
    ignores: [".next/**", "node_modules/**", "scripts/**"],
  },
];
