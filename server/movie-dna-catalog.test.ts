import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  groupMovieDnaOptions,
  findMovieDnaPresetForIdea,
  MOVIE_DNA_BUILT_IN_PRESETS,
  MOVIE_DNA_CATALOG,
  movieDnaCategory,
  searchMovieDnaOptions,
  toggleMovieDnaCategoryExpansion,
  visibleMovieDnaOptions,
  type MovieDnaOptionDefinition,
} from "../src/movie-dna-catalog.js";
import type { CreateProjectInput, MovieDnaCustomOption } from "../src/types.js";
import type { ImageGenerationInput, ImageGenerationOutput, ImageGenerationProvider } from "./image-generation/provider.js";
import { MovieDnaService } from "./movie-dna-service.js";
import { addCustomMovieDnaOption, applyMovieDnaPreset } from "./production-workflow.js";
import { SettingsStore } from "./settings.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
const root = () => {
  const value = path.join(tmpdir(), `continuity-global-dna-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(value);
  return value;
};

const input = (title: string, idea = "A character faces a difficult choice in a globally neutral production world."): CreateProjectInput => ({
  title, movieTitle: title, idea, genre: "Unselected", runtimeMinutes: 1, sequenceCount: 6, sequenceDurationSeconds: 10,
  language: "English", filmLanguage: "English", dialogueLanguage: "English", visualStyle: "Unselected", mode: "phases", brain: "local", storyMode: "AI_FIRST",
  era: "Unselected", aspectRatio: "1.85:1", resolution: "4K UHD", audienceRating: "PG-13", targetPlatform: "Custom",
  narrationEnabled: false, dialogueEnabled: true, musicEnabled: true, subtitlesEnabled: true,
  autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false,
});

class PreviewProvider implements ImageGenerationProvider {
  readonly id = "catalog-preview";
  readonly model = "catalog-test";
  readonly paid = false;
  inputs: ImageGenerationInput[] = [];
  estimateCost() { return 0; }
  async generate(value: ImageGenerationInput): Promise<ImageGenerationOutput> {
    this.inputs.push(value);
    return { image: Buffer.from(`image:${value.id}`), thumbnail: Buffer.from(`thumb:${value.id}`), provider: this.id, model: this.model };
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("global data-driven Movie DNA catalogue", () => {
  it("expands and collapses every category independently without duplicate options", () => {
    let expanded: Record<string, boolean> = {};
    for (const category of MOVIE_DNA_CATALOG) {
      const collapsed = visibleMovieDnaOptions(category, false);
      expect(collapsed.length).toBeLessThanOrEqual(category.collapsedLimit);
      expanded = toggleMovieDnaCategoryExpansion(expanded, category.id);
      const complete = visibleMovieDnaOptions(category, expanded[category.id]!);
      expect(complete).toHaveLength(category.options.filter((entry) => entry.status === "active").length);
      expect(new Set(complete.map((entry) => entry.id)).size).toBe(complete.length);
      expect(Object.entries(expanded).filter(([id, open]) => id !== category.id && open)).toHaveLength(0);
      expanded = toggleMovieDnaCategoryExpansion(expanded, category.id);
      expect(expanded[category.id]).toBe(false);
    }
  });

  it("searches groups, names, descriptions, tags, periods, and related catalogue terms", () => {
    const genres = movieDnaCategory("genre")!;
    expect(searchMovieDnaOptions(genres.options, "western").map((entry) => entry.name)).toEqual(expect.arrayContaining(["Western", "Neo Western"]));
    expect(searchMovieDnaOptions(genres.options, "space").map((entry) => entry.name)).toEqual(expect.arrayContaining(["Space Opera", "Space Adventure", "Cosmic Horror"]));
    expect(searchMovieDnaOptions(movieDnaCategory("historicalPeriod")!.options, "1940").map((entry) => entry.name)).toContain("1940s");
    expect(groupMovieDnaOptions(genres.options).map(([group]) => group)).toEqual(expect.arrayContaining(["Action", "Horror", "Science Fiction", "Animation", "Experimental"]));
  });

  it("renders a newly-added data option through the shared visibility helper without any React edit", () => {
    const category = structuredClone(movieDnaCategory("genre")!);
    const testOption = { ...category.options[0]!, id: "catalog_test_option", name: "Catalogue Test Option", popular: false } satisfies MovieDnaOptionDefinition;
    category.options.push(testOption);
    expect(visibleMovieDnaOptions(category, true).some((entry) => entry.id === testOption.id)).toBe(true);
    expect(visibleMovieDnaOptions(category, true, "catalogue test").map((entry) => entry.id)).toContain(testOption.id);
  });

  it("starts six global cinema projects neutral with no inherited UAE, 1965, desert, camel, Rashid, or horror DNA", async () => {
    const store = new ProjectStore(root());
    const projects = [
      "Modern Hollywood Superhero Film", "Victorian Gothic Horror", "Japanese Cyberpunk Thriller",
      "1970s American Crime Drama", "Emirati Historical Drama", "Animated Fantasy Adventure",
    ];
    for (const title of projects) {
      const project = await store.createProject(input(title, `${title} needs a new production direction chosen by the user.`), { kind: "builtin", label: "Built-in", available: true });
      expect(project.production.movieDna.selections).toEqual({});
      expect(project.production.movieDna.genreOptionIds).toEqual([]);
      expect(JSON.stringify(project.production.movieDna)).not.toMatch(/Rashid|camel|UAE 1965|Muted Desert/i);
    }
    expect(MOVIE_DNA_BUILT_IN_PRESETS.map((preset) => preset.name)).toEqual(expect.arrayContaining(projects.slice(1)));
  });

  it("uses the expanded global catalogue for Help Me Choose and keeps every preset selection valid", () => {
    const ideas = ["modern superhero science fiction action", "Victorian Gothic manor", "Japanese Tokyo cyberpunk", "1970s American crime", "Emirati historical family drama", "animated family fantasy"];
    expect(ideas.map((idea) => findMovieDnaPresetForIdea(idea)?.preset.name)).toEqual([
      "Modern Hollywood Superhero", "Victorian Gothic Horror", "Japanese Cyberpunk Thriller", "1970s American Crime Drama", "Emirati Historical Drama", "Animated Fantasy Adventure",
    ]);
    for (const preset of MOVIE_DNA_BUILT_IN_PRESETS) {
      for (const [categoryId, optionIds] of Object.entries(preset.selections)) {
        const category = movieDnaCategory(categoryId);
        expect(category, `${preset.name} category ${categoryId}`).toBeDefined();
        for (const optionId of optionIds) expect(category?.options.some((entry) => entry.id === optionId), `${preset.name}: ${categoryId}:${optionId}`).toBe(true);
      }
    }
  });

  it("generates and restores custom Genre, Color Grade, Environment, and Photography previews after restart", async () => {
    const store = new ProjectStore(root());
    const project = await store.createProject(input("Custom DNA Persistence"), { kind: "builtin", label: "Built-in", available: true });
    const provider = new PreviewProvider();
    const service = new MovieDnaService(store, provider);
    const cases = [
      { categoryId: "genre", name: "Ecological Mystery", description: "Patient ecological investigation with mounting natural tension." },
      { categoryId: "colorGrade", name: "Burabeeh Pearl", description: "Neutral skin, pearl highlights and cool open shadows.", technicalValues: { temperature: -120, tint: 3, contrast: 104, saturation: 92, blackLevel: "soft", highlightRolloff: "long" } },
      { categoryId: "environment", name: "Floating City Above Jupiter", description: "A habitable cloud city suspended above Jupiter's storm bands." },
      { categoryId: "photography", name: "1978 Observational Film", description: "Available light, soft 35mm contrast and restrained handheld response." },
    ];
    for (const value of cases) {
      const custom = addCustomMovieDnaOption(project, value);
      await service.regeneratePreview(project, value.categoryId, custom.id);
    }
    project.production.movieDna.comparisonOptionIds = cases.map((value) => `${value.categoryId}:${project.production.movieDna.customOptions[value.categoryId]![0]!.id}`);
    await store.saveProject(project);

    const reopened = await new ProjectStore(store.rootDir).getProject(project.id);
    for (const value of cases) {
      const custom = reopened.production.movieDna.customOptions[value.categoryId]?.[0];
      expect(custom?.source).toBe("custom");
      const preview = reopened.production.movieDna.previews[`${value.categoryId}:${custom!.id}`]!;
      expect(preview.status).toBe("GENERATED");
      expect(preview.path && await store.projectFileExists(project.id, preview.path)).toBe(true);
      expect(reopened.production.movieDna.selections[value.categoryId]?.optionIds).toContain(custom!.id);
    }
    expect(reopened.production.movieDna.comparisonOptionIds).toHaveLength(4);
  });

  it("persists a reusable personal preset and applies its custom options to another project", async () => {
    const directory = root();
    const projectStore = new ProjectStore(path.join(directory, "projects"));
    const first = await projectStore.createProject(input("Preset Source"), { kind: "builtin", label: "Built-in", available: true });
    const custom = addCustomMovieDnaOption(first, { categoryId: "environment", name: "Orbital Garden", description: "A rotating garden habitat above Earth." });
    const timestamp = new Date().toISOString();
    const preset = {
      id: "preset-user-orbital", name: "BURABEEH ORBITAL", description: "Reusable orbital look",
      selections: { environment: [custom.id], genre: ["genre_scifi"] }, customOptions: structuredClone(first.production.movieDna.customOptions),
      createdAt: timestamp, updatedAt: timestamp, useCount: 0,
    };
    const settingsPath = path.join(directory, "settings.json");
    const settings = new SettingsStore(settingsPath);
    await settings.update({ movieDnaPresets: [preset] });
    const reopenedSettings = await new SettingsStore(settingsPath).get();
    expect(reopenedSettings.movieDnaPresets[0]?.name).toBe("BURABEEH ORBITAL");

    const second = await projectStore.createProject(input("Preset Target"), { kind: "builtin", label: "Built-in", available: true });
    applyMovieDnaPreset(second, preset.selections, preset.customOptions as Record<string, MovieDnaCustomOption[]>);
    expect(second.production.movieDna.selections.environment?.label).toBe("Orbital Garden");
    expect(second.production.movieDna.selections.genre?.label).toBe("Science Fiction");
  });
});
