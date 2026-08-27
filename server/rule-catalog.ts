import globalConfig from "../rules/global_rules.json";
import continuityConfig from "../rules/continuity_rules.json";
import characterConfig from "../rules/character_rules.json";
import assetConfig from "../rules/asset_rules.json";
import sequenceConfig from "../rules/sequence_rules.json";
import frameConfig from "../rules/frame_rules.json";
import generationConfig from "../rules/generation_rules.json";
import modelConfig from "../rules/model_rules.json";
import type { RuleDefinition, RuleProfile, RuleProfileType } from "../src/types.js";

interface RuleConfigFile {
  profile: string;
  rules: Array<Omit<RuleDefinition, "enabled">>;
}

const configFiles = [
  globalConfig,
  continuityConfig,
  characterConfig,
  assetConfig,
  sequenceConfig,
  frameConfig,
  generationConfig,
  modelConfig,
] as unknown as RuleConfigFile[];

export const FILM_RULES: RuleDefinition[] = configFiles.flatMap((file) =>
  file.rules.map((rule) => ({ ...rule, enabled: true })),
);

const profileType = (name: string): RuleProfileType => {
  if (name === "Character Rules") return "character";
  if (name === "Sequence Rules") return "sequence";
  if (name === "Model Rules") return "model";
  if (name === "Project Rules") return "project";
  return "global";
};

export const createRuleProfiles = (): RuleProfile[] =>
  ["Global Rules", "Project Rules", "Character Rules", "Sequence Rules", "Model Rules"].map(
    (name) => ({
      id: `PROFILE_${name.replaceAll(" ", "_").toUpperCase()}`,
      name,
      type: profileType(name),
      enabled: true,
      overrides: [],
    }),
  );

export const cloneFilmRules = () => structuredClone(FILM_RULES);
