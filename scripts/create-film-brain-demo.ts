import path from "node:path";
import { ProductionAgent } from "../server/agent.js";
import { LocalPhaseEngine } from "../server/local-engine.js";
import { ProjectStore } from "../server/store.js";

const title = "The Last Camp — Film Brain Demo";
const store = new ProjectStore(path.join(process.cwd(), "data", "projects"));
await store.initialize();
const existing = (await store.listProjects()).find((project) => project.title === title);
const agent = new ProductionAgent(store, new LocalPhaseEngine({ delayMs: 0 }));

let project;
if (existing) {
  project = await store.getProject(existing.id);
  project.mode = "full";
  project.autoGenerateAssets = true;
  project.autoGenerateScenes = true;
  project.autoGenerateStoryboard = true;
  project.storyMode = "AI_FIRST";
  project.preStorySetup.completed = true;
  await store.saveProject(project);
  const database = project.memory.database;
  const hasRetiredSequenceAsset = ((project.artifacts.sequences as { sequences?: Array<{ assetIds: string[] }> } | undefined)?.sequences ?? []).some((sequence) => sequence.assetIds.includes("CHAR_GUIDE_001"));
  if (!database.assets.some((asset) => asset.id === "PROP_CAMPFIRE_001") || !database.assets.some((asset) => asset.generatedImagePath) || !database.storyboardFrames.some((frame) => frame.imagePath) || !database.characters.some((asset) => /old man/i.test(asset.name)) || hasRetiredSequenceAsset || database.continuitySheets.length !== database.assets.length) {
    await agent.regenerate(project.id, "story", "Refresh the demonstration with the functional reference, visual asset, scene, storyboard, and platform prompt compiler pipeline.");
    await agent.waitForIdle(project.id);
    project = await store.getProject(project.id);
  }
} else {
  const created = await agent.createProject({
    title,
    idea: "Six minute Emirati desert horror film. 1965 UAE desert. One traveller named Rashid travels with one camel and discovers a mysterious Bedouin camp.",
    genre: "Emirati Desert Horror",
    runtimeMinutes: 6,
    sequenceCount: 12,
    language: "Arabic / Emirati dialect",
    visualStyle: "Grounded 1965 Gulf cinema, 2.39:1, restrained grain, practical firelight, period-correct desert realism",
    mode: "full",
    brain: "local",
    storyMode: "AI_FIRST",
    era: "1965 UAE",
    aspectRatio: "2.39:1",
    autoGenerateAssets: true,
    autoGenerateScenes: true,
    autoGenerateStoryboard: true,
  });
  await agent.start(created.id, "full");
  await agent.waitForIdle(created.id);
  project = await store.getProject(created.id);
}

if (project.status !== "complete") {
  throw new Error(`Demo project did not complete: ${project.status}.`);
}

const database = project.memory.database;
process.stdout.write(`${JSON.stringify({
  id: project.id,
  title: project.title,
  status: project.status,
  rules: database.rules.length,
  assets: database.assets.length,
  sequences: (project.artifacts.sequences as { sequences: unknown[] }).sequences.length,
  frames: database.frames.length,
  continuityStates: database.continuityStates.length,
  prompts: database.generationPrompts.length,
  blockingIssues: database.validationIssues.filter((issue) => issue.blocking && !issue.overridden && !issue.resolved).length,
  generatedImages: database.imageGenerationJobs.filter((job) => job.status === "GENERATED").length,
  continuitySheets: database.continuitySheets.length,
  sceneAssets: database.sceneAssets.length,
  storyboardFrames: database.storyboardFrames.length,
  platformPrompts: database.generationPrompts.length,
}, null, 2)}\n`);
