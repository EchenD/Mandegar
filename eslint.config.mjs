import nextVitals from "eslint-config-next/core-web-vitals";

const config = [{ ignores: ["node_modules/**", "node_modules.preseed/**", ".next/**"] }, ...nextVitals];

export default config;
