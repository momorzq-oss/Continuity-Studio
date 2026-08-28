import type { MovieDnaCustomOption } from "./types";

export type MovieDnaContactSheet = "genre" | "look" | "camera";

export interface MovieDnaOptionDefinition {
  id: string;
  name: string;
  category: string;
  group: string;
  shortDescription: string;
  technicalDescription: string;
  promptDescription: string;
  previewGenerationPrompt: string;
  technicalValues: Record<string, string | number | boolean>;
  tags: string[];
  compatibilityTags: string[];
  historicalTags: string[];
  genreTags: string[];
  source: "built-in" | "custom";
  status: "active" | "archived";
  popular: boolean;
  selectedByDefault: boolean;
  previewAssetId?: string;
  sheet: MovieDnaContactSheet;
  visualIndex: number;
}

export interface MovieDnaCategoryDefinition {
  id: string;
  name: string;
  note: string;
  comparisonBaseScene: string;
  collapsedLimit: number;
  multi?: boolean;
  required?: boolean;
  options: MovieDnaOptionDefinition[];
}

export interface MovieDnaBuiltInPreset {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  selections: Record<string, string[]>;
}

const stableIndex = (value: string) => [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 16;
const token = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const option = (
  category: string,
  id: string,
  name: string,
  group: string,
  shortDescription: string,
  sheet: MovieDnaContactSheet,
  technicalValues: Record<string, string | number | boolean> = {},
  settings: Partial<Pick<MovieDnaOptionDefinition, "popular" | "promptDescription" | "previewGenerationPrompt" | "tags" | "compatibilityTags" | "historicalTags" | "genreTags" | "visualIndex">> = {},
): MovieDnaOptionDefinition => {
  const technicalDescription = Object.keys(technicalValues).length
    ? Object.entries(technicalValues).map(([key, value]) => `${key.replaceAll(/([A-Z])/g, " $1").toLowerCase()}: ${String(value)}`).join("; ")
    : shortDescription;
  return {
    id, name, category, group, shortDescription, technicalDescription,
    promptDescription: settings.promptDescription ?? `${name}. ${shortDescription} ${technicalDescription}.`,
    previewGenerationPrompt: settings.previewGenerationPrompt ?? `Render the fixed neutral comparison scene using ${name}: ${shortDescription}`,
    technicalValues,
    tags: [...new Set([name, group, ...(settings.tags ?? [])].flatMap((tag) => tag.toLowerCase().split(/\s+/)).filter(Boolean))],
    compatibilityTags: settings.compatibilityTags ?? [], historicalTags: settings.historicalTags ?? [], genreTags: settings.genreTags ?? [],
    source: "built-in", status: "active", popular: settings.popular ?? false, selectedByDefault: false,
    sheet, visualIndex: settings.visualIndex ?? stableIndex(id),
  };
};

const namedOptions = (
  category: string,
  sheet: MovieDnaContactSheet,
  groups: Record<string, string[]>,
  popularNames: string[] = [],
  technicalFactory: (name: string, group: string) => Record<string, string | number | boolean> = (name, group) => ({ direction: name, family: group }),
) => Object.entries(groups).flatMap(([group, names]) => names.map((name) => option(
  category, `${token(category)}_${token(name)}`, name, group,
  `${name} production language with a technically controlled ${group.toLowerCase()} treatment.`,
  sheet, technicalFactory(name, group), { popular: popularNames.includes(name), tags: [name, group] },
)));

const remapIds = (options: MovieDnaOptionDefinition[], ids: Record<string, string>) => {
  for (const entry of options) if (ids[entry.name]) entry.id = ids[entry.name]!;
  return options;
};

const neutralStageScene = "The identical neutral comparison stage: one adult performer, plain practical wardrobe, simple interior and exterior depth cues, balanced daylight, no country, era, genre, or named-character assumptions.";
const neutralPortraitScene = "The identical neutral portrait: one anonymous adult performer, plain wardrobe, fixed pose, fixed distance, balanced exposure and a globally neutral background.";
const neutralWorldScene = "The identical neutral world plate: simple unbranded built forms, open ground, one anonymous human scale reference, balanced daylight, no country, period, climate, genre, or story assumptions.";

const genreOptions = namedOptions("genre", "genre", {
  Action: ["Action", "Action Drama", "Action Thriller", "Epic Action", "Superhero Action", "Street Racing Action"],
  Adventure: ["Adventure", "Epic Adventure", "Comic Book Adventure", "Adventure Comedy", "Space Adventure"],
  Horror: ["Horror", "Supernatural Horror", "Psychological Horror", "Gothic Horror", "Folk Horror", "Creature Horror", "Monster Horror", "Cosmic Horror", "Body Horror", "Survival Horror", "Slasher", "Found Footage Horror", "Paranormal Horror"],
  "Science Fiction": ["Science Fiction", "Hard Science Fiction", "Space Opera", "Cyberpunk", "Post Apocalyptic", "Dystopian", "Alien Invasion", "Time Travel", "Tech Thriller", "Science Fiction Horror"],
  Fantasy: ["Fantasy", "Dark Fantasy", "High Fantasy", "Urban Fantasy", "Arabian Fantasy", "Mythological Fantasy", "Epic Fantasy"],
  Superhero: ["Superhero", "Superhero Drama", "Superhero Action", "Comic Book Adventure"],
  Drama: ["Drama", "Epic Drama", "Family Drama", "Psychological Drama", "Historical Drama", "Political Drama", "Courtroom Drama", "Social Drama", "Romantic Drama"],
  Crime: ["Crime", "Crime Drama", "Gangster", "Heist", "Detective", "Neo Noir", "Film Noir", "Murder Mystery"],
  Thriller: ["Thriller", "Psychological Thriller", "Conspiracy Thriller", "Espionage Thriller", "Political Thriller", "Mystery"],
  Romance: ["Romance", "Romantic Drama", "Romantic Comedy"],
  Comedy: ["Comedy", "Dark Comedy", "Satire", "Family Comedy", "Adventure Comedy", "Mockumentary"],
  Historical: ["Historical", "Epic Historical", "Period Drama", "Biography", "Docudrama"],
  War: ["War", "Military", "Historical War", "Spy"], Western: ["Western", "Neo Western"],
  Documentary: ["Documentary", "Docudrama", "Mockumentary", "News Documentary"],
  Family: ["Family", "Children", "Coming of Age", "Sports", "Musical"],
  Animation: ["Animation", "3D Animation", "2D Animation", "Stop Motion", "Anime Inspired Cinematic Animation"],
  Experimental: ["Experimental", "Art House", "Independent Cinema", "Silent Film", "Road Movie", "Disaster", "Survival"],
}, ["Action", "Adventure", "Horror", "Science Fiction", "Fantasy", "Drama", "Comedy", "Thriller"]);
remapIds(genreOptions, { Horror: "genre_horror", Drama: "genre_drama", Thriller: "genre_thriller", "Science Fiction": "genre_scifi", "Arabian Fantasy": "genre_fantasy", Historical: "genre_historical", Mystery: "genre_mystery" });
genreOptions.find((entry) => entry.name === "Cosmic Horror")?.tags.push("space", "cosmos", "alien");
genreOptions.splice(1, 0, option("genre", "genre_epic", "Epic", "Adventure", "Mythic scale, large staging and sustained historical or imagined pressure.", "genre", { scale: "mythic", staging: "large" }, { popular: true }));
{
  const seen = new Set<string>();
  const unique = genreOptions.filter((entry) => !seen.has(entry.id) && Boolean(seen.add(entry.id)));
  genreOptions.splice(0, genreOptions.length, ...unique);
}

const cinematicStyleOptions = [
  option("cinematography", "cine_motivated", "Motivated Realism", "Cinematic Grammar", "Natural behaviour, intentional blocking and readable geography.", "camera", { composition: "motivated", screenDirection: "protected" }, { popular: true }),
  option("cinematography", "cine_classical", "Classical Cinema", "Cinematic Grammar", "Elegant coverage, controlled staging and tonal separation.", "camera", { coverage: "classical", blocking: "disciplined" }, { popular: true }),
  option("cinematography", "cine_observational", "Observational Minimalism", "Cinematic Grammar", "Patient compositions prioritise behaviour over camera presence.", "camera", { cameraPresence: "minimal", takes: "patient" }),
  option("cinematography", "cine_expressionist", "Expressionist Control", "Cinematic Grammar", "Angle, contrast and spatial pressure visibly shape emotion.", "camera", { perspective: "expressive", geometry: "pressured" }),
  ...namedOptions("cinematography", "camera", {
    "Commercial Cinema": ["Modern Hollywood Blockbuster", "Hollywood Prestige Drama", "Hollywood Action Spectacle", "Hollywood Epic", "Hollywood Thriller", "Hollywood Horror", "Hollywood Studio Comedy", "Theatrical Blockbuster", "Modern Streaming Cinema", "Premium Television Drama", "Low Budget Indie"],
    "Global Cinema": ["Independent American Cinema", "European Art Cinema", "British Cinema", "French Cinema", "Italian Cinema", "German Cinema", "Scandinavian Cinema", "Korean Cinema", "Japanese Cinema", "Hong Kong Action Cinema", "Indian Epic Cinema", "Gulf Cinema", "Arab Cinema", "Emirati Cinema"],
    "Historical Movements": ["Classic Hollywood", "Golden Age Hollywood", "New Hollywood 1970s", "1980s Hollywood", "1990s Hollywood", "2000s Hollywood", "Documentary Realism"],
    "Cinematic Universe Presets": ["Superhero Cinematic Universe", "Comic Book Blockbuster", "Shared Universe Action", "Large Scale Franchise Adventure", "Modern Superhero Drama", "Cosmic Superhero Epic", "Grounded Superhero Thriller", "Monster Universe", "Classic Monster Gothic", "Modern Creature Universe", "Dinosaur Adventure Blockbuster", "Space Franchise Adventure", "Spy Franchise Action", "Street Racing Action", "Military Action Blockbuster", "Fantasy Franchise Epic", "Wizarding Fantasy Adventure", "Mythological Action Epic"],
    "Studio Reference Labels": ["Marvel Cinematic Universe Reference", "DC Style Superhero Universe Reference", "Universal Monster Cinema Reference", "Classic Universal Horror Reference", "Warner Style Prestige Blockbuster Reference", "Paramount Style Action Adventure Reference", "Sony Style Commercial Cinema Reference", "Disney Live Action Fantasy Reference", "20th Century Style Epic Cinema Reference", "A24 Style Independent Cinematic Reference", "Netflix Premium Cinematic Reference", "Apple Premium Drama Reference", "Amazon MGM Cinematic Reference", "Golden Age Hollywood Reference"],
  }, ["Modern Hollywood Blockbuster", "Hollywood Prestige Drama", "European Art Cinema", "Korean Cinema", "Japanese Cinema", "Classic Hollywood", "Documentary Realism"], (name, group) => ({
    productionScale: /blockbuster|epic|universe|franchise|spectacle/i.test(name) ? "large scale" : /indie|art|documentary/i.test(name) ? "restrained" : "premium",
    dynamicRange: "high with protected skin tones", subjectSeparation: "strong and story-led", establishingCoverage: "environmentally legible",
    cameraMovement: /action|superhero|adventure|racing/i.test(name) ? "dynamic controlled movement" : "motivated movement",
    framing: /superhero|action/i.test(name) ? "hero frames, spectacle wides and emotional close coverage" : "performance-led coverage",
    vfxIntegration: /universe|monster|fantasy|space|superhero|dinosaur/i.test(name) ? "polished physically integrated VFX" : "invisible supporting VFX",
    contrast: "cinematic controlled", formatFeeling: /blockbuster|epic|universe/i.test(name) ? "large format" : "theatrical", referenceFamily: group,
  })),
];

const photographyOptions = [
  option("photography", "photo_35mm", "35mm Cinema", "Film Capture", "Organic grain and soft highlight roll-off.", "look", { capture: "35mm", grain: "organic", latitude: "wide" }, { popular: true }),
  option("photography", "photo_16mm", "16mm Cinema", "Film Capture", "Visible texture, raw edges and intimate scale.", "look", { capture: "16mm", grain: "visible", sharpness: "modest" }, { popular: true }),
  option("photography", "photo_vintage", "Vintage Cinema", "Period Looks", "Gentle contrast, halation and aged colour response.", "look", { capture: "photochemical inspired", halation: "gentle" }),
  option("photography", "photo_documentary", "Documentary", "Documentary", "Available-light feeling and observational immediacy.", "look", { lighting: "available", cameraPresence: "observational" }, { popular: true }),
  option("photography", "photo_digital", "Digital Cinema", "Digital Capture", "Clean detail, neutral colour and controlled low light.", "look", { capture: "digital", detail: "clean", noise: "minimal" }, { popular: true }),
  option("photography", "photo_large_format", "IMAX Style Large Format", "Large Format", "Smooth separation, dimensional depth and epic fine detail.", "look", { capture: "large format", depth: "dimensional" }, { popular: true }),
  ...namedOptions("photography", "look", {
    "Film Capture": ["65mm Cinema", "70mm Epic Cinema", "Vintage Technicolor", "Classic Black and White", "Film Noir"],
    "Digital Capture": ["ARRI Alexa Style Digital Cinema", "Sony Venice Style Cinema", "RED Style Digital Cinema", "Modern Hollywood", "Premium Streaming Drama"],
    "Period Looks": ["Golden Age Hollywood", "1970s Naturalistic Cinema", "1980s Commercial Cinema", "1990s Hollywood Cinema"],
    Documentary: ["News Documentary", "War Documentary", "Handheld Realism", "Natural Light Cinema", "Low Light Cinema"],
    "Editorial Looks": ["Polished Commercial", "Music Video Cinema", "High Fashion Cinema", "High Contrast Cinema", "Soft Diffused Cinema", "Bleach Bypass", "Cross Processed Film"],
  }, ["65mm Cinema", "ARRI Alexa Style Digital Cinema", "Modern Hollywood"]),
];

const filmStockOptions = [
  option("filmStock", "stock_5203", "Kodak Vision3 50D", "Kodak Vision3", "Very fine grain and crisp sunlit colour.", "look", { stock: "5203", iso: 50, balance: "daylight" }, { popular: true }),
  option("filmStock", "stock_5207", "Kodak Vision3 250D", "Kodak Vision3", "Fine daylight grain and natural colour.", "look", { stock: "5207", iso: 250, balance: "daylight" }, { popular: true }),
  option("filmStock", "stock_5213", "Kodak Vision3 200T", "Kodak Vision3", "Fine tungsten balance with natural skin and practicals.", "look", { stock: "5213", iso: 200, balance: "tungsten" }),
  option("filmStock", "stock_5219", "Kodak Vision3 500T", "Kodak Vision3", "Low-light latitude, warm practicals and rich density.", "look", { stock: "5219", iso: 500, balance: "tungsten" }, { popular: true }),
  option("filmStock", "stock_ektachrome", "Ektachrome Inspired Reversal", "Reversal", "Saturated reversal colour and decisive contrast.", "look", { stock: "Ektachrome inspired", iso: 100, process: "reversal" }, { popular: true }),
  option("filmStock", "stock_fuji", "Fuji Inspired Cinema Stock", "Fuji Inspired", "Gentle greens, restrained reds and delicate skin.", "look", { stock: "Fuji inspired", palette: "soft" }, { popular: true }),
  ...namedOptions("filmStock", "look", { "Film Response": ["Kodak Inspired Vintage Daylight", "Kodak Inspired Vintage Tungsten", "Technicolor Inspired Palette", "Black and White Fine Grain", "Black and White High Contrast", "Vintage Faded Negative"] }),
];

const gradeOptions = [
  option("colorGrade", "grade_warm_cinematic", "Warm Cinematic", "Cinematic", "Amber highlights with rich, natural mids.", "look", { saturation: 108, contrast: 104, shadows: "warm neutral and open", highlights: "amber and protected", temperature: "+450K", blackLevel: "soft black", colourBias: "amber" }, { popular: true }),
  option("colorGrade", "grade_cold_horror", "Cold Blue Horror", "Horror", "Blue shadows, reduced warmth and dense atmosphere.", "look", { saturation: 82, contrast: 116, shadows: "deep blue", highlights: "cold neutral", temperature: "-900K", blackLevel: "dense", colourBias: "blue cyan" }, { popular: true }),
  option("colorGrade", "grade_muted_desert", "Muted Desert", "Landscape", "Warm sand, low saturation and neutral shadows.", "look", { saturation: 76, contrast: 96, shadows: "neutral open", highlights: "warm sand", temperature: "+250K", blackLevel: "slightly lifted", colourBias: "sand ochre" }),
  option("colorGrade", "grade_teal_orange", "Teal and Orange", "Commercial", "Cool environmental field with warm skin separation.", "look", { saturation: 112, contrast: 110, shadows: "teal", highlights: "warm orange", temperature: "+100K", blackLevel: "clean", colourBias: "teal/orange split" }, { popular: true }),
  option("colorGrade", "grade_vintage_faded", "Vintage Faded", "Film Print", "Soft blacks, aged pigments and reduced saturation.", "look", { saturation: 72, contrast: 84, shadows: "lifted warm grey", highlights: "cream", temperature: "+180K", blackLevel: "lifted", colourBias: "faded warm" }, { popular: true }),
  option("colorGrade", "grade_natural", "Natural Neutral", "Natural", "Balanced skin, honest colour and stable whites.", "look", { saturation: 100, contrast: 100, shadows: "neutral", highlights: "neutral protected", temperature: "0K", blackLevel: "true", colourBias: "none" }, { popular: true }),
  ...namedOptions("colorGrade", "look", {
    Cinematic: ["Cold Cinematic", "High Contrast", "Low Contrast", "Low Saturation", "Rich Saturation", "Warm Skin Cool Shadows", "Cool Skin Neutral Shadows"],
    "Film Process": ["Bleach Bypass", "Silver Retention", "Classic Film Print", "Technicolor Inspired", "Cross Processed"],
    Atmospheric: ["Pastel", "Golden Hour", "Moonlight Blue", "Dirty Amber", "Dusty Western", "War Desaturated", "Dreamlike Pastel", "Documentary Neutral"],
    Horror: ["Green Psychological Horror", "Crimson Horror", "Dark Fantasy"], Monochrome: ["Black and White", "Noir Black and White", "Sepia"],
    "Genre Colour": ["Cyberpunk Neon", "Sci Fi Cyan", "Fantasy Gold"],
  }, ["Cold Cinematic", "Bleach Bypass"]),
];

const periodNames = ["Prehistoric", "Ancient Civilizations", "Ancient Egypt", "Ancient Mesopotamia", "Ancient Greece", "Roman Empire", "Early Islamic Period", "Medieval", "Viking Age", "Crusader Period", "Renaissance", "1600s", "1700s", "1800s", "Victorian", "American Old West", "1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s", "Modern Day", "Near Future", "Far Future", "Post Apocalyptic Future", "Alternative History", "Fantasy Period", "Timeless"];
const periodOptions = namedOptions("historicalPeriod", "genre", {
  Ancient: periodNames.slice(0, 7), "Medieval to Early Modern": periodNames.slice(7, 13), "Industrial and Victorian": periodNames.slice(13, 16),
  "20th Century": periodNames.slice(16, 26), Contemporary: periodNames.slice(26, 30), Future: periodNames.slice(30),
}, ["Victorian", "1940s", "1970s", "1990s", "Modern Day", "Near Future"], (name) => ({ era: name, anachronismControl: "strict", technology: "period accurate", materials: "period accurate", wardrobe: "period accurate" }));
periodOptions.push(option("historicalPeriod", "period_ancient", "Ancient World", "Ancient", "Hand-built materials and pre-industrial technology.", "genre", { era: "ancient" }));
periodOptions.push(option("historicalPeriod", "period_1960s_gulf", "1960s Arabian Gulf", "20th Century", "Analog objects, regional clothing and period architecture.", "genre", { era: "1960s", region: "Arabian Gulf" }));
remapIds(periodOptions, { "1980s": "period_1980s", Contemporary: "period_contemporary" });
periodOptions.push(option("historicalPeriod", "period_contemporary", "Contemporary", "Contemporary", "Current technology and lived modern environments.", "genre", { era: "contemporary" }, { popular: true }));

const locationOptions = namedOptions("location", "genre", {
  "North America": ["United States", "Mexico"], "United Kingdom and Ireland": ["United Kingdom"],
  Gulf: ["United Arab Emirates", "Saudi Arabia", "Oman", "Qatar", "Bahrain", "Kuwait"],
  "Middle East and North Africa": ["Egypt", "Morocco", "Jordan", "Lebanon"],
  Europe: ["France", "Italy", "Germany", "Spain", "Greece", "Norway", "Sweden", "Iceland", "Russia"],
  Asia: ["India", "China", "Japan", "South Korea", "Thailand", "Indonesia"],
  "Oceania and Southern Hemisphere": ["Australia", "Brazil", "Argentina", "South Africa"],
}, ["United States", "United Kingdom", "United Arab Emirates", "France", "India", "China", "Japan", "South Korea"]);

const environmentOptions = namedOptions("environment", "genre", {
  Urban: ["Modern City", "Old City", "Megacity", "Small Town", "Village", "Futuristic City", "Cyberpunk City", "Post Apocalyptic City", "Ruined City", "Industrial District"],
  "Land and Climate": ["Desert", "Desert Camp", "Oasis", "Forest", "Rainforest", "Jungle", "Mountain", "Snow Mountain", "Tundra", "Farm", "Countryside", "Swamp"],
  Water: ["Ocean", "Underwater", "Beach", "Island", "River"], Underground: ["Cave", "Underground", "Mine", "Bunker"],
  "Transport and Space": ["Airport", "Space Station", "Spaceship", "Alien Planet", "Moon", "Mars", "Ship", "Submarine", "Train"],
  Institutional: ["Military Base", "Battlefield", "Factory", "Warehouse", "Hospital", "School", "University", "Office", "Laboratory", "Prison"],
  "Architecture and Home": ["Luxury Hotel", "Old Hotel", "Castle", "Palace", "Temple", "Mosque", "Church", "Ancient Ruins", "Museum", "House", "Apartment", "Villa", "Mansion", "Farmhouse", "Cabin", "Abandoned Village"],
}, ["Modern City", "Small Town", "Desert", "Forest", "Mountain", "Ocean", "Futuristic City", "House"]);
remapIds(environmentOptions, { "Desert Camp": "env_desert", "Old City": "env_old_dubai", "Abandoned Village": "env_village", Mountain: "env_mountains", Ocean: "env_coastal" });

const framingOptions = namedOptions("framing", "camera", {
  "Shot Size": ["Extreme Wide", "Wide", "Medium Wide", "Medium", "Medium Close Up", "Close Up", "Extreme Close Up", "Insert", "Macro"],
  Coverage: ["Over Shoulder", "Two Shot", "Group Shot", "POV"], Angles: ["Low Angle", "High Angle", "Dutch Angle", "Eye Level", "Ground Level", "Top Down", "Birds Eye", "Aerial", "Drone"],
  "Optical Framing": ["Long Lens", "Wide Angle", "Anamorphic", "Spherical", "Large Format"],
}, ["Wide", "Medium", "Medium Close Up", "Close Up", "Over Shoulder", "Two Shot", "POV", "Eye Level"]);
remapIds(framingOptions, { Wide: "frame_wide", Medium: "frame_medium", "Close Up": "frame_close", "Extreme Close Up": "frame_extreme", "Low Angle": "frame_low", "High Angle": "frame_high", POV: "frame_pov", "Eye Level": "frame_eye" });

const movementOptions = namedOptions("cameraMovement", "camera", {
  Static: ["Static"], Pushes: ["Slow Push In", "Fast Push In", "Slow Pull Out", "Crash Zoom", "Dolly Zoom"], Dolly: ["Dolly Forward", "Dolly Back", "Dolly Left", "Dolly Right"],
  Tracking: ["Tracking Left", "Tracking Right", "Leading Tracking", "Following Tracking"], Circular: ["Orbit Left", "Orbit Right"],
  Vertical: ["Crane Up", "Crane Down", "Boom", "Drone Rise", "Drone Descend"], Stabilized: ["Steadicam", "Gimbal"], Human: ["Handheld", "Shoulder Camera", "POV Movement"],
  Drone: ["Drone Forward"], "Pan and Tilt": ["Whip Pan", "Pan Left", "Pan Right", "Tilt Up", "Tilt Down"], Focus: ["Rack Focus"],
}, ["Static", "Slow Push In", "Dolly Forward", "Tracking Left", "Handheld", "Steadicam", "Gimbal", "Drone Forward"]);
remapIds(movementOptions, { Static: "move_static", "Slow Push In": "move_push", "Tracking Left": "move_tracking", Handheld: "move_handheld", "Drone Forward": "move_drone" });

const lightingOptions = namedOptions("lighting", "look", {
  Natural: ["Natural Daylight", "Overcast", "Golden Hour", "Sunrise", "Sunset", "Blue Hour", "Harsh Desert Sun", "Window Light"],
  Night: ["Moonlight", "Full Moon", "Firelight", "Candlelight", "Torchlight", "Street Light", "Car Headlights", "Police Lights", "Horror Practical Lighting"],
  Practical: ["Practical Interior", "Fluorescent", "Tungsten", "Neon", "Sci Fi Interior", "Underwater Light"],
  Studio: ["Studio Soft Light", "Hard Studio Light", "High Key", "Low Key", "Rembrandt", "Silhouette", "Backlight", "Rim Light", "Volumetric", "Fog Diffusion"],
}, ["Natural Daylight", "Overcast", "Golden Hour", "Moonlight", "Practical Interior", "Studio Soft Light", "Low Key", "Backlight"]);
remapIds(lightingOptions, { "Natural Daylight": "light_day", "Golden Hour": "light_golden", Moonlight: "light_moon", Firelight: "light_fire", Overcast: "light_overcast", Rembrandt: "light_chiaroscuro" });

const textureOptions = namedOptions("texture", "look", {
  Clean: ["Clean Cinematic", "Polished Blockbuster", "Sharp Modern", "Photoreal", "Hyperreal", "Commercial"],
  Film: ["Organic Film Grain", "Heavy Film Grain", "Fine Grain", "Soft Vintage", "Retro", "Dirty Lens"], Natural: ["Naturalistic", "Documentary", "Gritty Realism", "Stylized Realism"],
  Atmospheric: ["Dark Atmospheric", "Dreamlike", "Surreal", "Soft Diffusion", "Foggy", "Dusty", "Wet Night", "Rainy", "High Fashion"],
}, ["Clean Cinematic", "Organic Film Grain", "Fine Grain", "Naturalistic", "Documentary", "Gritty Realism", "Dreamlike", "Polished Blockbuster"]);
remapIds(textureOptions, { "Organic Film Grain": "texture_organic", "Clean Cinematic": "texture_clean", "Soft Vintage": "texture_soft", "Dark Atmospheric": "texture_dark" });

const focalOptions = [8, 12, 14, 18, 20, 21, 24, 28, 32, 35, 40, 50, 65, 75, 85, 100, 105, 135, 200, 300].map((mm, index) => option("focalLength", `focal_${mm}`, `${mm}mm`, mm <= 24 ? "Ultra Wide" : mm <= 50 ? "Normal Range" : mm <= 105 ? "Portrait and Telephoto" : "Long Telephoto", mm < 30 ? "Expanded space and strong environmental perspective." : mm < 60 ? "Natural subject-to-world relationship." : "Compressed space and isolated expression.", "camera", { focalLengthMm: mm, compression: mm >= 85 ? "strong" : mm >= 50 ? "moderate" : "low" }, { popular: [18, 24, 35, 50, 85, 135].includes(mm), visualIndex: index % 16 }));
focalOptions.push(option("focalLength", "focal_macro", "Macro", "Specialty", "Extreme close focus with precise texture and shallow working depth.", "camera", { focalLength: "macro", closeFocus: true }));
focalOptions.push(...["Anamorphic 32mm Equivalent", "Anamorphic 40mm Equivalent", "Anamorphic 50mm Equivalent", "Anamorphic 75mm Equivalent"].map((name) => option("focalLength", `focal_${token(name)}`, name, "Anamorphic Equivalents", "Anamorphic field-of-view and depth behaviour.", "camera", { focalLength: name, projection: "anamorphic" })));

const aspectOptions = namedOptions("aspectRatio", "camera", { Standard: ["1:1", "4:3", "Academy 1.37:1", "3:2", "16:9", "1.66:1", "1.78:1", "1.85:1", "2:1"], Widescreen: ["2.20:1", "2.35:1", "2.39:1", "2.40:1", "21:9", "IMAX Style"], Vertical: ["Vertical 9:16"] }, ["4:3", "16:9", "1.85:1", "2:1", "2.39:1", "IMAX Style"]);
remapIds(aspectOptions, { "2.39:1": "aspect_239", "1.85:1": "aspect_185", "16:9": "aspect_169", "4:3": "aspect_43", "1:1": "aspect_11" });

const simpleCategory = (id: string, name: string, note: string, scene: string, options: MovieDnaOptionDefinition[], settings: Partial<Pick<MovieDnaCategoryDefinition, "multi" | "required" | "collapsedLimit">> = {}): MovieDnaCategoryDefinition => ({ id, name, note, comparisonBaseScene: scene, collapsedLimit: settings.collapsedLimit ?? 8, multi: settings.multi, required: settings.required, options });
const legacyNamed = (category: string, sheet: MovieDnaContactSheet, values: Array<[string, string, string]>, popular = 3) => values.map(([id, name, description], index) => option(category, id, name, "Core", description, sheet, { direction: name }, { popular: index < popular }));

export const MOVIE_DNA_CATALOG: MovieDnaCategoryDefinition[] = [
  simpleCategory("genre", "Genre DNA", "Combine any number of story genres into one interpreted production direction.", neutralWorldScene, genreOptions, { multi: true, required: true }),
  simpleCategory("cinematography", "Cinematic Style DNA", "Production feeling is separate from story genre; recognizable labels are translated into technical characteristics.", neutralStageScene, cinematicStyleOptions, { required: true }),
  simpleCategory("photography", "Film Photography DNA", "Compare capture texture, latitude, sharpness and highlight response on the same neutral scene.", neutralPortraitScene, photographyOptions, { required: true }),
  simpleCategory("cameraSystem", "Camera System", "The capture system defines latitude, colour response, motion and production character.", neutralPortraitScene, [
    option("cameraSystem", "camera_alexa35", "ARRI Alexa 35", "Digital Cinema", "Natural skin and soft highlight roll-off.", "camera", { latitudeStops: 17, sensor: "Super 35" }, { popular: true }),
    option("cameraSystem", "camera_venice2", "Sony Venice 2", "Digital Cinema", "Clean low-light colour and full-frame perspective.", "camera", { sensor: "Full frame", lowLight: "clean" }, { popular: true }),
    option("cameraSystem", "camera_vraptor", "RED V-Raptor XL", "Digital Cinema", "High-resolution detail and strong motion capture.", "camera", { resolution: "8K", motion: "precise" }),
    option("cameraSystem", "camera_35film", "35mm Film Camera", "Film Camera", "Photochemical motion texture and organic response.", "camera", { medium: "35mm film", motion: "photochemical" }, { popular: true }),
    option("cameraSystem", "camera_16film", "16mm Film Camera", "Film Camera", "Lively grain and intimate handheld character.", "camera", { medium: "16mm film", grain: "pronounced" }),
    option("cameraSystem", "camera_65film", "65mm Film Camera", "Large Format", "Large negative, fine grain and dimensional spectacle.", "camera", { medium: "65mm film", format: "large" }),
    option("cameraSystem", "camera_imax", "IMAX Style Camera", "Large Format", "Immersive field and very high perceived detail.", "camera", { format: "IMAX style", scale: "immersive" }),
  ]),
  simpleCategory("framing", "Camera & Framing DNA", "Preview subject scale, angle and point of view with the same performer and location.", neutralPortraitScene, framingOptions, { required: true }),
  simpleCategory("lensStyle", "Lens Style", "Compare optical rendering without changing the subject.", neutralPortraitScene, [
    option("lensStyle", "lens_anamorphic", "Anamorphic", "Projection", "Oval bokeh, horizontal flare and expressive edges.", "camera", { projection: "anamorphic", bokeh: "oval" }, { popular: true }),
    option("lensStyle", "lens_vintage_spherical", "Vintage Spherical", "Projection", "Gentle falloff, halation and dimensional close focus.", "camera", { projection: "spherical", character: "vintage" }, { popular: true }),
    option("lensStyle", "lens_modern_spherical", "Modern Spherical", "Projection", "Clean geometry, consistent contrast and accurate colour.", "camera", { projection: "spherical", character: "modern" }, { popular: true }),
    ...namedOptions("lensStyle", "camera", { Specialty: ["Large Format Spherical", "Vintage Anamorphic", "Modern Anamorphic", "Soft Portrait Lens", "High Contrast Lens", "Low Contrast Lens", "Macro Lens", "Probe Lens"] }),
  ]),
  simpleCategory("focalLength", "Lens & Focal Length DNA", "The same subject distance reveals field of view, distortion and compression.", neutralPortraitScene, focalOptions, { required: true }),
  simpleCategory("filmStock", "Film Stock DNA", "Compare colour response, grain and exposure behaviour.", neutralStageScene, filmStockOptions),
  simpleCategory("grain", "Film Grain", "Grain size and density are compared over the identical neutral frame.", neutralStageScene, legacyNamed("grain", "look", [["grain_fine35", "Fine 35mm Grain", "Fine organic texture with stable size."], ["grain_visible16", "Visible 16mm Grain", "Lively texture and tactile period energy."], ["grain_soft_vintage", "Soft Vintage Grain", "Rounded texture with gentle halation."], ["grain_clean", "Near-Clean Digital", "Very fine texture without plastic smoothing."]])),
  simpleCategory("colorGrade", "Color Grade DNA", "A locked grade stores exact colour behaviour and a final prompt description.", neutralStageScene, gradeOptions, { required: true }),
  simpleCategory("contrast", "Contrast", "Compare toe, shoulder and midtone separation.", neutralStageScene, legacyNamed("contrast", "look", [["contrast_soft", "Medium Soft", "Soft toe and shoulder with separated midtones."], ["contrast_high", "High Controlled", "Deep blacks and bright protected highlights."], ["contrast_low", "Low Atmospheric", "Compressed range carried by colour and haze."], ["contrast_hard", "Hard Graphic", "Decisive separation and strong silhouette."], ["contrast_print", "Film Print Contrast", "Print-like shoulder, toe and midtone density."]])),
  simpleCategory("saturation", "Saturation", "Compare overall colour intensity while preserving skin.", neutralStageScene, legacyNamed("saturation", "look", [["sat_restrained", "Restrained Natural", "Muted world with selective story-colour separation."], ["sat_rich", "Rich Selective", "Chosen hues strengthen while skin stays accurate."], ["sat_mono", "Near Monochrome", "Narrow palette carried by material and light."], ["sat_pastel", "Pastel Controlled", "Soft chroma with protected skin."], ["sat_vivid", "Vivid Commercial", "High chroma with disciplined clipping control."]])),
  simpleCategory("exposure", "Exposure", "Compare face priority, highlight protection and night behaviour.", neutralPortraitScene, legacyNamed("exposure", "look", [["exp_highlights", "Protect Highlights", "Hold bright texture and sky colour while faces remain readable."], ["exp_faces", "Expose for Faces", "Skin consistency leads with controlled background sacrifice."], ["exp_shadows", "Shadow Priority Night", "Readable low values and luminous practical sources."], ["exp_balanced", "Balanced Negative", "Neutral negative placement with broad latitude."], ["exp_highkey", "High Key Exposure", "Bright controlled values without clipping."], ["exp_lowkey", "Low Key Exposure", "Dark authored values with selective detail."]])),
  simpleCategory("lighting", "Lighting DNA", "The same subject reveals direction, softness, colour and falloff.", neutralPortraitScene, lightingOptions, { required: true }),
  simpleCategory("shadows", "Shadows", "Compare density, colour and readable detail.", neutralPortraitScene, legacyNamed("shadows", "look", [["shadow_open", "Open Textured", "Readable chromatic detail without milky blacks."], ["shadow_dense", "Dense Shaped", "Rich blacks with selective retained story detail."], ["shadow_cool", "Cool Ambient", "Cool low values separate from warm subjects."], ["shadow_warm", "Warm Ambient", "Warm low values preserve material colour."], ["shadow_crushed", "Crushed Graphic", "Deliberate near-black silhouette design."], ["shadow_lifted", "Lifted Filmic", "Raised black floor with photochemical softness."]])),
  simpleCategory("highlights", "Highlights", "Compare roll-off, definition and halation.", neutralPortraitScene, legacyNamed("highlights", "look", [["highlight_soft", "Soft Roll Off", "Specular sources bloom gently and retain hue."], ["highlight_crisp", "Crisp Controlled", "Clean definition with protected skin."], ["highlight_halated", "Halated Photochemical", "Warm luminous edge bloom with organic response."], ["highlight_bloom", "Blooming Dreamlike", "Soft broad bloom with retained color."], ["highlight_hard", "Hard Specular", "Small decisive sources with clean edges."]])),
  simpleCategory("depthOfField", "Depth of Field DNA", "The same marks and distance reveal focus separation.", neutralPortraitScene, legacyNamed("depthOfField", "camera", [["dof_deep", "Deep Focus", "Foreground, action and geography stay readable."], ["dof_moderate", "Moderate", "Subject leads while the place remains identifiable."], ["dof_shallow", "Shallow", "Portrait separation with disciplined focus marks."], ["dof_extreme", "Extreme Shallow", "Compressed isolated expression and minimal background detail."], ["dof_split", "Split Diopter", "Two planes hold focus with intentional optical tension."]]), { required: true }),
  simpleCategory("cameraMovement", "Camera Movement DNA", "Movement behavior is stored in the prompt and previewed through consistent framing.", neutralStageScene, movementOptions, { required: true }),
  simpleCategory("texture", "Image Feel DNA", "Choose the material surface and emotional finish of the final image.", neutralStageScene, textureOptions, { required: true }),
  simpleCategory("productionDesign", "Production Design", "Materials, architecture, objects and spatial logic must belong to one world.", neutralWorldScene, legacyNamed("productionDesign", "genre", [["design_period", "Period Material Truth", "Historically coherent construction, wear and objects."], ["design_minimal", "Restrained Practical", "Few purposeful objects and readable negative space."], ["design_layered", "Layered Lived In", "Accumulated use, patina and story-rich dressing."], ["design_mythic", "Mythic Material", "Grounded materials arranged with iconic visual scale."], ["design_contemporary", "Polished Contemporary", "Current materials and controlled lived detail."], ["design_graphic", "Graphic Stylized", "Strong shape and color systems with physical scale."], ["design_found", "Documentary Found World", "Existing spaces preserved with minimal intervention."]])),
  simpleCategory("historicalPeriod", "Period DNA", "Period controls technology, materials, clothing and anachronism rules; geography remains separate.", neutralWorldScene, periodOptions, { required: true }),
  simpleCategory("location", "Global Location DNA", "Country, city and region remain independent from period and environment.", neutralWorldScene, locationOptions, { required: true }),
  simpleCategory("costume", "Costume Direction", "Costume style is distinct from character identity and remains state-aware.", neutralPortraitScene, legacyNamed("costume", "genre", [["costume_period", "Strict Period Costume", "Historically verified fabric, cut and accessories."], ["costume_practical", "Practical Worn", "Functional layers with visible use and repair."], ["costume_elevated", "Elevated Heroic", "Recognisable silhouettes with controlled ornament."], ["costume_minimal", "Restrained Natural", "Quiet palette and behaviour-led clothing."], ["costume_contemporary", "Contemporary Realism", "Current clothing with character-specific wear."], ["costume_fashion", "High Fashion", "Editorial silhouette and material control."], ["costume_military", "Military Accurate", "Rank, function and period-correct equipment."], ["costume_fantasy", "Fantasy Material", "Invented silhouette grounded in believable construction."]])),
  simpleCategory("environment", "Environment DNA", "Weather, ground, atmosphere and geography persist across the film.", neutralWorldScene, environmentOptions, { required: true }),
  simpleCategory("vfx", "VFX Style", "Effects inherit lens, grain, light, scale and atmosphere.", neutralWorldScene, legacyNamed("vfx", "genre", [["vfx_invisible", "Invisible Supporting VFX", "Natural integration subordinate to photography."], ["vfx_practical", "Practical First", "Physical effects lead with restrained digital extension."], ["vfx_ethereal", "Ethereal Supernatural", "Atmospheric anomaly with believable light interaction."], ["vfx_spectacle", "Controlled Spectacle", "Large effects retain physical scale and continuity."], ["vfx_creature", "Photoreal Creature", "Physical creature weight and integrated light."], ["vfx_graphic", "Graphic Stylized VFX", "Authored shape language and controlled realism."], ["vfx_optical", "Miniature and Optical", "Practical miniature scale and optical texture."]])),
  simpleCategory("realism", "Realism Level", "Set how far visual expression may depart from ordinary reality.", neutralStageScene, legacyNamed("realism", "look", [["realism_grounded", "Grounded Cinematic", "Photoreal behaviour with authored composition."], ["realism_heightened", "Heightened Realism", "Believable physics with intensified light and colour."], ["realism_stylized", "Stylized Material", "Graphic design with physical surfaces and scale."], ["realism_documentary", "Documentary Natural", "Minimal polish and observational truth."], ["realism_photoreal", "Photoreal", "Strict physically plausible rendering."], ["realism_hyperreal", "Hyperreal", "Enhanced detail within coherent physics."], ["realism_surreal", "Surreal Physical", "Impossible ideas rendered with material conviction."]])),
  simpleCategory("aspectRatio", "Aspect Ratio DNA", "The preview visibly changes framing and compositional pressure.", neutralStageScene, aspectOptions, { required: true }),
];

export const MOVIE_DNA_BUILT_IN_PRESETS: MovieDnaBuiltInPreset[] = [
  { id: "preset_superhero", name: "Modern Hollywood Superhero", description: "Large-format, polished, dynamic superhero science-fiction action.", keywords: ["superhero", "comic", "hero", "marvel", "dc"], selections: { genre: ["genre_superhero_action", "genre_scifi", "genre_drama"], cinematography: ["cinematography_modern_hollywood_blockbuster"], photography: ["photo_large_format"], framing: ["frame_low"], lensStyle: ["lens_anamorphic"], focalLength: ["focal_35"], colorGrade: ["colorgrade_high_contrast"], lighting: ["lighting_backlight"], texture: ["texture_polished_blockbuster"], aspectRatio: ["aspect_239"] } },
  { id: "preset_victorian_gothic", name: "Victorian Gothic Horror", description: "British period material truth, Gothic darkness and controlled firelight.", keywords: ["victorian", "gothic"], selections: { genre: ["genre_gothic_horror", "genre_historical_drama"], cinematography: ["cinematography_british_cinema"], photography: ["photo_35mm"], historicalPeriod: ["historicalperiod_victorian"], location: ["location_united_kingdom"], environment: ["env_old_dubai"], lighting: ["lighting_candlelight"], colorGrade: ["grade_cold_horror"], aspectRatio: ["aspect_185"] } },
  { id: "preset_japanese_cyberpunk", name: "Japanese Cyberpunk Thriller", description: "Japanese urban futurism with neon, precise camera language and wet-night texture.", keywords: ["japan", "japanese", "tokyo", "cyberpunk", "neon"], selections: { genre: ["genre_cyberpunk", "genre_thriller"], cinematography: ["cinematography_japanese_cinema"], location: ["location_japan"], environment: ["environment_cyberpunk_city"], photography: ["photo_digital"], colorGrade: ["colorgrade_cyberpunk_neon"], lighting: ["lighting_neon"], texture: ["texture_wet_night"], aspectRatio: ["aspect_239"] } },
  { id: "preset_1970_crime", name: "1970s American Crime Drama", description: "Naturalistic American crime photography with restrained movement and film texture.", keywords: ["1970", "american", "crime", "gangster"], selections: { genre: ["genre_crime_drama", "genre_thriller"], cinematography: ["cinematography_new_hollywood_1970s"], photography: ["photography_1970s_naturalistic_cinema"], historicalPeriod: ["historicalperiod_1970s"], location: ["location_united_states"], filmStock: ["stock_5219"], texture: ["texture_organic"], aspectRatio: ["aspect_185"] } },
  { id: "preset_emirati_drama", name: "Emirati Historical Drama", description: "Regionally grounded historical drama without imposing genre, grade or environment defaults.", keywords: ["emirati", "uae", "gulf"], selections: { genre: ["genre_historical_drama", "genre_drama"], cinematography: ["cinematography_emirati_cinema"], location: ["location_united_arab_emirates"], photography: ["photo_35mm"], colorGrade: ["grade_natural"], texture: ["texture_naturalistic"], aspectRatio: ["aspect_185"] } },
  { id: "preset_animated_fantasy", name: "Animated Fantasy Adventure", description: "Family fantasy adventure with controlled stylization and an expansive frame.", keywords: ["animated", "animation", "family", "fantasy"], selections: { genre: ["genre_animation", "genre_fantasy", "genre_adventure"], cinematography: ["cinematography_fantasy_franchise_epic"], photography: ["photography_polished_commercial"], colorGrade: ["colorgrade_fantasy_gold"], texture: ["texture_stylized_realism"], realism: ["realism_stylized"], aspectRatio: ["aspect_239"] } },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const movieDnaCategory = (id: string) => MOVIE_DNA_CATALOG.find((category) => category.id === id);
export const movieDnaOption = (categoryId: string, optionId: string) => movieDnaCategory(categoryId)?.options.find((entry) => entry.id === optionId);
export const movieDnaOptions = (category: MovieDnaCategoryDefinition, customOptions: MovieDnaCustomOption[] = []) => [...category.options.filter((entry) => entry.status === "active"), ...customOptions.filter((entry) => entry.status === "active")] as MovieDnaOptionDefinition[];

export const searchMovieDnaOptions = (options: MovieDnaOptionDefinition[], query: string) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return options;
  return options.filter((entry) => {
    const haystack = normalize([entry.name, entry.group, entry.shortDescription, entry.technicalDescription, entry.promptDescription, ...entry.tags, ...entry.compatibilityTags, ...entry.historicalTags, ...entry.genreTags].join(" "));
    return words.every((word) => haystack.includes(word)) || words.some((word) => haystack.includes(word));
  });
};

export const visibleMovieDnaOptions = (category: MovieDnaCategoryDefinition, expanded: boolean, query = "", customOptions: MovieDnaCustomOption[] = []) => {
  const all = movieDnaOptions(category, customOptions);
  if (expanded) return searchMovieDnaOptions(all, query);
  const custom = all.filter((entry) => entry.source === "custom");
  const popular = all.filter((entry) => entry.source !== "custom" && entry.popular);
  return [...custom, ...popular, ...all.filter((entry) => entry.source !== "custom" && !entry.popular)].slice(0, category.collapsedLimit);
};

export const groupMovieDnaOptions = (options: MovieDnaOptionDefinition[]) => Object.entries(options.reduce<Record<string, MovieDnaOptionDefinition[]>>((groups, entry) => {
  (groups[entry.group] ??= []).push(entry);
  return groups;
}, {}));

export const toggleMovieDnaCategoryExpansion = (state: Record<string, boolean>, categoryId: string) => ({ ...state, [categoryId]: !state[categoryId] });
export const findMovieDnaPresetForIdea = (idea: string) => {
  const text = normalize(idea);
  return [...MOVIE_DNA_BUILT_IN_PRESETS]
    .map((preset) => ({ preset, score: preset.keywords.reduce((score, keyword) => score + (text.includes(normalize(keyword)) ? 1 : 0), 0) }))
    .sort((left, right) => right.score - left.score)[0];
};
