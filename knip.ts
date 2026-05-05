import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: ["debug/**"],
  ignoreBinaries: ["wrangler", "python3"],
  workspaces: {
    "apps/web": {
      ignoreDependencies: ["postcss"],
    },
    "apps/crawler": {
      ignore: ["src/auth.ts", "src/hooks/helpers.ts"],
    },
    "apps/simulator": {
      ignoreDependencies: ["postcss"],
    },
  },
};

export default config;
