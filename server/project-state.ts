import type { MovieProject, ProjectSetupPatch } from "../src/types.js";

export const calculateSequenceCount = (runtimeMinutes: number, sequenceDurationSeconds: number) =>
  Math.max(1, Math.min(120, Math.ceil((runtimeMinutes * 60) / sequenceDurationSeconds)));

export const applyProjectSetup = (
  project: MovieProject,
  patch: ProjectSetupPatch,
  options: { lock?: boolean } = {},
) => {
  Object.assign(project, patch);
  project.movieTitle = project.movieTitle?.trim() || project.title;
  project.sequenceCount = calculateSequenceCount(project.runtimeMinutes, project.sequenceDurationSeconds);
  project.language = project.filmLanguage === project.dialogueLanguage
    ? project.filmLanguage
    : `${project.filmLanguage} / ${project.dialogueLanguage}`;

  const updatedAt = new Date().toISOString();
  project.production.updatedAt = updatedAt;
  const gate = project.production.gates.find((item) => item.stage === "project_setup");
  if (gate) {
    Object.assign(gate, {
      status: options.lock ? "LOCKED" : gate.status === "LOCKED" ? "LOCKED" : "READY",
      updatedAt,
      note: options.lock
        ? `${project.sequenceCount} sequences calculated and project setup locked.`
        : `${project.sequenceCount} sequences calculated; setup draft autosaved.`,
    });
  }
  if (options.lock && project.production.currentStage === "project_setup") {
    project.production.currentStage = "movie_dna";
  }
  return project;
};
