import type {
  DbExamBlueprint,
  DbExamItem,
  ExamBlueprintStage,
  ExamMode,
  FormItemSnapshot,
} from "@/lib/exams/types";

type SeedItem = Omit<
  DbExamItem,
  "_id" | "createdAt" | "updatedAt" | "eligibleStageIds" | "stimulusGroupId" | "stimulusId"
>;
type Blueprint = Omit<DbExamBlueprint, "_id" | "createdAt" | "updatedAt">;

const choices = (...labels: string[]) => labels.map((label, index) => ({
  id: String.fromCharCode(65 + index),
  label,
}));

function baseItem(input: Pick<SeedItem,
  "id" | "exam" | "section" | "itemType" | "domain" | "skill" | "prompt" | "correctAnswer"
> & Partial<SeedItem>): SeedItem {
  return {
    difficulty: 3,
    explanation: "",
    estimatedTimeSeconds: 75,
    tags: [],
    status: "approved",
    version: 1,
    provenance: "polaris-original-exam-bank-v2",
    ...input,
  };
}

function satReadingWriting(prefix: string, count: number, difficulty: number, variant: number): SeedItem[] {
  const domains = [
    "Information and Ideas",
    "Craft and Structure",
    "Expression of Ideas",
    "Standard English Conventions",
  ];
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const domain = domains[index % domains.length];
    const study = 18 + n * 2 + variant * 7;
    if (domain === "Information and Ideas") {
      return baseItem({
        id: `${prefix}-${String(n).padStart(2, "0")}`,
        exam: "SAT",
        section: "Reading and Writing",
        itemType: "multiple-choice",
        domain,
        skill: "Command of evidence",
        difficulty,
        stimulus: {
          kind: "text",
          content: `A city garden study compared two equally sized plots. The plot using compost produced ${study} kilograms of vegetables, while the plot without compost produced ${study - 6} kilograms under the same watering schedule.`,
        },
        prompt: "Which conclusion is best supported by the study?",
        options: choices(
          "In this study, the compost plot produced more vegetables.",
          "Compost always doubles vegetable production.",
          "Watering had no effect on either plot.",
          "The plot without compost used less land.",
        ),
        correctAnswer: { kind: "choice", value: "A" },
        explanation: "The only directly supported comparison is the higher yield in the compost plot.",
      });
    }
    if (domain === "Craft and Structure") {
      return baseItem({
        id: `${prefix}-${String(n).padStart(2, "0")}`,
        exam: "SAT",
        section: "Reading and Writing",
        itemType: "multiple-choice",
        domain,
        skill: "Words in context",
        difficulty,
        stimulus: { kind: "text", content: `The archive's new index was meticulous: each of its ${study} entries included a date, source, and cross-reference.` },
        prompt: "As used in the text, “meticulous” most nearly means",
        options: choices("temporary", "careful", "public", "unusual"),
        correctAnswer: { kind: "choice", value: "B" },
        explanation: "The details in every entry show that the index was prepared carefully.",
      });
    }
    if (domain === "Expression of Ideas") {
      return baseItem({
        id: `${prefix}-${String(n).padStart(2, "0")}`,
        exam: "SAT",
        section: "Reading and Writing",
        itemType: "multiple-choice",
        domain,
        skill: "Transitions",
        difficulty,
        stimulus: { kind: "text", content: `Prototype ${study} stored energy efficiently during laboratory trials. ______, its weight prevented the research team from using it in a portable field device.` },
        prompt: "Which choice completes the text with the most logical transition?",
        options: choices("Similarly", "However", "For example", "Therefore"),
        correctAnswer: { kind: "choice", value: "B" },
        explanation: "The second sentence contrasts with the first, so “However” is logical.",
      });
    }
    return baseItem({
      id: `${prefix}-${String(n).padStart(2, "0")}`,
      exam: "SAT",
      section: "Reading and Writing",
      itemType: "multiple-choice",
      domain,
      skill: "Boundaries",
      difficulty,
      stimulus: { kind: "text", content: `Biologist Lina Ortega cataloged ${study} plant samples ______ she then compared their leaf structures.` },
      prompt: "Which choice completes the text so that it conforms to Standard English conventions?",
      options: choices(", she", "; she", " she", ": and she"),
      correctAnswer: { kind: "choice", value: "B" },
      explanation: "A semicolon correctly joins the two independent clauses.",
    });
  });
}

const SAT_MATH_DOMAINS = [
  ...Array(8).fill("Algebra"),
  ...Array(8).fill("Advanced Math"),
  ...Array(3).fill("Problem-Solving and Data Analysis"),
  ...Array(3).fill("Geometry and Trigonometry"),
] as string[];

/**
 * Accepted forms of one numeric answer.
 *
 * A one-decimal form is only offered when it is exactly equal to the answer.
 * Emitting it unconditionally accepted a genuinely wrong value (166.8 for
 * 166.75) and printed it back to the student as a correct alternative.
 */
function numericAccepted(value: number): string[] {
  const exact = String(Number(value.toFixed(6)));
  const rounded = value.toFixed(1);
  return Number(rounded) === Number(exact) ? [...new Set([exact, rounded])] : [exact];
}

function satMath(prefix: string, difficulty: number, variant: number): SeedItem[] {
  return SAT_MATH_DOMAINS.map((domain, index) => {
    const n = index + 1;
    const a = 2 + ((index + variant) % 5);
    const x = 3 + ((index + variant * 2) % 7);
    const b = 4 + index + variant * 3;
    if (domain === "Algebra") {
      const result = a * x + b;
      return baseItem({
        id: `${prefix}-${String(n).padStart(2, "0")}`, exam: "SAT", section: "Math",
        itemType: "multiple-choice", domain, skill: "Linear equations", difficulty,
        prompt: `What value of x satisfies ${a}x + ${b} = ${result}?`,
        options: choices(String(x - 2), String(x - 1), String(x), String(x + 2)),
        correctAnswer: { kind: "choice", value: "C" },
        explanation: `Subtract ${b}, then divide by ${a}, to obtain x = ${x}.`,
      });
    }
    if (domain === "Advanced Math") {
      const r1 = 2 + ((index + variant) % 4);
      const r2 = r1 + 3 + variant;
      return baseItem({
        id: `${prefix}-${String(n).padStart(2, "0")}`, exam: "SAT", section: "Math",
        itemType: "multiple-choice", domain, skill: "Quadratic equations", difficulty,
        prompt: `The equation (x − ${r1})(x − ${r2}) = 0 has two solutions. What is the larger solution?`,
        options: choices(String(-r2), String(r1), String(r2), String(r1 + r2)),
        correctAnswer: { kind: "choice", value: "C" },
        explanation: `The solutions are ${r1} and ${r2}; the larger is ${r2}.`,
      });
    }
    if (domain === "Problem-Solving and Data Analysis") {
      const original = 40 + index * 5 + variant * 10;
      const increase = 10 + ((index + variant) % 3) * 5;
      const next = original * (1 + increase / 100);
      return baseItem({
        id: `${prefix}-${String(n).padStart(2, "0")}`, exam: "SAT", section: "Math",
        itemType: "student-produced-response", domain, skill: "Percent change", difficulty,
        prompt: `A value of ${original} increases by ${increase}%. Enter the new value.`,
        correctAnswer: { kind: "numeric", accepted: numericAccepted(next) },
        explanation: `Multiply ${original} by ${1 + increase / 100}.`,
      });
    }
    const scale = 1 + ((index + variant) % 3);
    const leg = 3 * scale;
    const other = 4 * scale;
    const hypotenuse = 5 * scale;
    return baseItem({
      id: `${prefix}-${String(n).padStart(2, "0")}`, exam: "SAT", section: "Math",
      itemType: "student-produced-response", domain, skill: "Right triangles", difficulty,
      prompt: `A right triangle has legs of length ${leg} and ${other}. Enter the hypotenuse.`,
      correctAnswer: { kind: "numeric", accepted: numericAccepted(hypotenuse) },
      explanation: "Apply the Pythagorean theorem.",
    });
  });
}

const READING_PASSAGES = [
  {
    title: "Restoring urban wetlands",
    content: "For much of the twentieth century, city planners treated wetlands as unused land. Recent projects have reversed that approach. In Harborside, engineers removed concrete channels and replanted native reeds across 18 hectares. Five years later, surveys recorded 34 bird species, compared with 19 before restoration. Sensors also showed that the restored ground retained storm water for longer, reducing pressure on drains. The project did not eliminate flooding, and researchers caution that maintenance remains essential. Even so, nearby residents reported using the new paths regularly, showing that ecological infrastructure can also provide public space.",
  },
  {
    title: "The changing work of libraries",
    content: "Libraries were once measured mainly by the size of their printed collections. Today many institutions also lend digital media, tools, and recording equipment. A regional survey found that evening workshops attracted people who had not borrowed a printed book that year. Librarians stress that this does not make books irrelevant: quiet reading rooms remain among the most requested services. Instead, the modern library combines access to information with opportunities to create and share it. Funding is a persistent challenge because equipment requires replacement and staff need continuing training.",
  },
  {
    title: "Learning from migratory insects",
    content: "Scientists long assumed that long-distance migration required the large brains of birds or mammals. Tracking studies of monarch butterflies challenged that assumption. Monarchs use a time-adjusted sun compass, combining the sun's position with an internal clock. On cloudy days, magnetic cues may assist navigation. No single butterfly completes the entire multi-generation round trip between Mexico and northern North America. Laboratory experiments are valuable, but field observations remain necessary because wind, temperature, and landscape features interact in ways that are difficult to reproduce indoors.",
  },
];

const READING_FACTS = [
  ["Harborside restored 18 hectares.", "TRUE"],
  ["Bird diversity declined after restoration.", "FALSE"],
  ["The project completely eliminated flooding.", "FALSE"],
  ["Researchers measured longer storm-water retention.", "TRUE"],
  ["The text states the exact annual maintenance cost.", "NOT GIVEN"],
  ["Residents used paths in the restored area.", "TRUE"],
  ["Wetlands were always valued by twentieth-century planners.", "FALSE"],
  ["The restoration used native reeds.", "TRUE"],
  ["Sensors were used in the evaluation.", "TRUE"],
  ["The project had only ecological benefits.", "FALSE"],
  ["Thirty-four bird species were recorded later.", "TRUE"],
  ["Maintenance is unnecessary after restoration.", "FALSE"],
  ["Concrete channels were removed.", "TRUE"],
  ["Libraries are now measured only by printed collections.", "FALSE"],
  ["Some libraries lend recording equipment.", "TRUE"],
  ["Workshop attendees had all borrowed printed books that year.", "FALSE"],
  ["Quiet reading rooms remain highly requested.", "TRUE"],
  ["The text says every library offers tool lending.", "NOT GIVEN"],
  ["Equipment replacement creates a funding challenge.", "TRUE"],
  ["Staff training is no longer needed.", "FALSE"],
  ["Modern libraries can support creation and sharing.", "TRUE"],
  ["Books are described as irrelevant.", "FALSE"],
  ["The survey was regional.", "TRUE"],
  ["All workshops took place in the morning.", "FALSE"],
  ["The exact number of surveyed libraries is provided.", "NOT GIVEN"],
  ["Digital media is one modern library service.", "TRUE"],
  ["Monarch research challenged an earlier assumption.", "TRUE"],
  ["Monarchs use a time-adjusted sun compass.", "TRUE"],
  ["Every butterfly completes the full round trip.", "FALSE"],
  ["Magnetic cues may help on cloudy days.", "TRUE"],
  ["The passage says monarchs navigate only at night.", "FALSE"],
  ["Field observations remain necessary.", "TRUE"],
  ["Wind has no effect on migration.", "FALSE"],
  ["The migration spans multiple generations.", "TRUE"],
  ["The exact number of tracked butterflies is stated.", "NOT GIVEN"],
  ["Laboratory experiments have no value.", "FALSE"],
  ["Landscape features can interact with weather.", "TRUE"],
  ["Bird-sized brains are required for migration.", "FALSE"],
  ["The route includes Mexico and northern North America.", "TRUE"],
  ["Internal timing contributes to navigation.", "TRUE"],
] as const;

const IELTS_READING_ITEMS: SeedItem[] = READING_FACTS.map(([statement, answer], index) => {
  const passageIndex = index < 13 ? 0 : index < 26 ? 1 : 2;
  return baseItem({
    id: `ielts-reading-${String(index + 1).padStart(2, "0")}`,
    exam: "IELTS", section: `Reading Passage ${passageIndex + 1}`,
    itemType: "true-false-not-given",
    domain: ["Reading for detail", "Inference", "Writer's claims"][index % 3],
    skill: "True / False / Not Given",
    stimulus: { kind: "text", title: READING_PASSAGES[passageIndex].title, content: READING_PASSAGES[passageIndex].content },
    prompt: statement,
    options: choices("TRUE", "FALSE", "NOT GIVEN"),
    correctAnswer: { kind: "choice", value: answer === "TRUE" ? "A" : answer === "FALSE" ? "B" : "C" },
    explanation: `The passage makes this statement ${answer.toLowerCase().replace("not given", "not explicitly given")}.`,
    estimatedTimeSeconds: 90,
  });
});

export const IELTS_LISTENING_SCRIPTS = [
  "You are calling Northbridge Community Centre. The photography workshop begins on Tuesday the twelfth of March at six thirty in the evening. It is held in Room Fourteen. The fee is thirty-five pounds and includes printed materials. Please bring your own camera. Registration closes on Friday.",
  "Welcome to Lakeside Residence. Breakfast is served from seven until nine in the ground-floor dining hall. The laundry room is beside reception and uses prepaid cards. Quiet hours begin at ten thirty at night. Bicycles must be stored behind Block C, and visitors should sign in at the front desk.",
  "The student research project compared three roof materials during summer. White metal stayed coolest at twenty-eight degrees Celsius. Dark tile reached thirty-seven degrees, while the planted roof averaged thirty-one. The team measured temperature every fifteen minutes and found that moisture loss affected the planted roof after five rainless days.",
  "In today's lecture, we consider coastal archaeology. Wooden structures can survive underwater when oxygen levels are low. Divers first photograph a site and mark a grid before removing objects. Sediment samples reveal pollen and food remains. Conservation begins immediately because waterlogged wood may crack if it dries too quickly.",
] as const;

const LISTENING_FACTS = [
  ["Which day does the workshop begin?", "Tuesday"],
  ["Enter the date in March.", "12"],
  ["What time does it begin?", "6:30"],
  ["Which room is used?", "14"],
  ["How much is the fee in pounds?", "35"],
  ["What item should participants bring?", "camera"],
  ["Which day does registration close?", "Friday"],
  ["What kind of workshop is advertised?", "photography"],
  ["What is included with the fee?", "printed materials"],
  ["Where is the event held?", "community centre"],
  ["When does breakfast begin?", "7"],
  ["When does breakfast end?", "9"],
  ["On which floor is the dining hall?", "ground"],
  ["What is beside reception?", "laundry room"],
  ["What type of cards does the laundry use?", "prepaid"],
  ["When do quiet hours begin?", "10:30"],
  ["Behind which block are bicycles stored?", "C"],
  ["Where must visitors sign in?", "front desk"],
  ["What building is being described?", "residence"],
  ["What meal is mentioned?", "breakfast"],
  ["How many roof materials were compared?", "3"],
  ["Which material stayed coolest?", "white metal"],
  ["What was the coolest temperature?", "28"],
  ["Which material reached 37 degrees?", "dark tile"],
  ["What average was recorded for the planted roof?", "31"],
  ["How often was temperature measured?", "15 minutes"],
  ["What affected the planted roof?", "moisture loss"],
  ["After how many rainless days did this occur?", "5"],
  ["In which season did the study occur?", "summer"],
  ["What kind of project was this?", "research"],
  ["What type of archaeology is discussed?", "coastal"],
  ["What condition helps wooden structures survive?", "low oxygen"],
  ["Who photographs the site?", "divers"],
  ["What is marked before objects are removed?", "grid"],
  ["What samples reveal pollen?", "sediment"],
  ["Name one other remain revealed by samples.", "food"],
  ["When does conservation begin?", "immediately"],
  ["What material may crack?", "wood"],
  ["What causes the cracking risk?", "drying"],
  ["Where can wooden structures survive?", "underwater"],
] as const;

const IELTS_LISTENING_ITEMS: SeedItem[] = LISTENING_FACTS.map(([prompt, answer], index) => {
  const part = Math.floor(index / 10);
  return baseItem({
    id: `ielts-listening-${String(index + 1).padStart(2, "0")}`,
    exam: "IELTS", section: `Listening Part ${part + 1}`, itemType: "short-answer",
    domain: part < 2 ? "Everyday communication" : "Academic communication",
    skill: "Listening for specific information",
    stimulus: {
      kind: "audio",
      title: `Listening Part ${part + 1}`,
      content: "Play the recording and answer Questions " + `${part * 10 + 1}–${part * 10 + 10}.`,
      mediaUrl: `part-${part + 1}`,
    },
    prompt,
    correctAnswer: { kind: "text", accepted: [answer] },
    explanation: `The recording states “${answer}”.`,
    estimatedTimeSeconds: 45,
  });
});

const IELTS_WRITING_ITEMS: SeedItem[] = [
  baseItem({
    id: "ielts-writing-task-1", exam: "IELTS", section: "Writing Task 1", itemType: "long-response",
    domain: "Academic Writing Task 1", skill: "Summarising visual information",
    stimulus: {
      kind: "table",
      title: "Average daily journeys by transport mode (thousands)",
      content: "Mode | 2010 | 2015 | 2020\nBus | 42 | 48 | 51\nRail | 25 | 31 | 44\nBicycle | 12 | 18 | 27\nCar | 68 | 64 | 58",
      alt: "A table comparing daily journeys by bus, rail, bicycle, and car in 2010, 2015, and 2020.",
    },
    prompt: "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    explanation: "This response is reviewed through transparent practice metrics and optional AI coaching; no official IELTS band is claimed.",
    estimatedTimeSeconds: 20 * 60,
  }),
  baseItem({
    id: "ielts-writing-task-2", exam: "IELTS", section: "Writing Task 2", itemType: "long-response",
    domain: "Academic Writing Task 2", skill: "Developing and supporting a position",
    prompt: "Some people believe universities should focus mainly on skills for employment, while others believe broader academic knowledge is equally important. Discuss both views and give your own opinion. Write at least 250 words.",
    explanation: "This response is reviewed through transparent practice metrics and optional AI coaching; no official IELTS band is claimed.",
    estimatedTimeSeconds: 40 * 60,
  }),
];

const IELTS_SPEAKING_ITEMS: SeedItem[] = [
  baseItem({
    id: "ielts-speaking-part-1", exam: "IELTS", section: "Speaking Part 1", itemType: "speaking-response",
    domain: "Introduction and interview", skill: "Personal questions",
    prompt: "Answer these questions: What do you study? What part of your studies interests you most? How do you usually organise your study time?",
    explanation: "The recording and transcript support self-review and optional AI coaching.", estimatedTimeSeconds: 4 * 60,
  }),
  baseItem({
    id: "ielts-speaking-part-2", exam: "IELTS", section: "Speaking Part 2", itemType: "speaking-response",
    domain: "Individual long turn", skill: "Sustained response",
    stimulus: { kind: "text", title: "Candidate task card", content: "Describe a skill you learned that was difficult at first. Say what the skill was, why you learned it, how you practised it, and explain how you felt when you improved." },
    prompt: "You have one minute to prepare. Then speak for up to two minutes.",
    explanation: "The recording and transcript support self-review and optional AI coaching.", estimatedTimeSeconds: 3 * 60,
  }),
  baseItem({
    id: "ielts-speaking-part-3", exam: "IELTS", section: "Speaking Part 3", itemType: "speaking-response",
    domain: "Two-way discussion", skill: "Abstract discussion",
    prompt: "Discuss these questions: Why do some people stop learning difficult skills? Should schools assess practical skills? How might technology change the way people learn in the future?",
    explanation: "The recording and transcript support self-review and optional AI coaching.", estimatedTimeSeconds: 5 * 60,
  }),
];

const stage = (
  id: string,
  title: string,
  section: string,
  kind: ExamBlueprintStage["kind"],
  minutes: number,
  questionCount: number,
  extras: Partial<ExamBlueprintStage> = {},
): ExamBlueprintStage => ({ id, title, section, kind, durationSeconds: minutes * 60, questionCount, ...extras });

export const EXAM_BLUEPRINTS_V2: Blueprint[] = [
  {
    id: "sat-full-adaptive-v2", exam: "SAT", mode: "sat-full",
    title: "Full Adaptive SAT-Style Mock",
    description: "A complete unofficial digital SAT-style exam with adaptive second modules and a timed break.",
    version: 2, status: "active",
    stages: [
      stage("sat-rw-m1", "Reading and Writing · Module 1", "Reading and Writing", "questions", 32, 27, { route: "core" }),
      stage("sat-rw-m2-standard", "Reading and Writing · Module 2", "Reading and Writing", "questions", 32, 27, { route: "standard" }),
      stage("sat-rw-m2-advanced", "Reading and Writing · Module 2", "Reading and Writing", "questions", 32, 27, { route: "advanced" }),
      stage("sat-break", "Scheduled Break", "Break", "break", 10, 0, { route: "core", instructions: "Take up to ten minutes. You may continue early when you are ready." }),
      stage("sat-math-m1", "Math · Module 1", "Math", "questions", 35, 22, { route: "core" }),
      stage("sat-math-m2-standard", "Math · Module 2", "Math", "questions", 35, 22, { route: "standard" }),
      stage("sat-math-m2-advanced", "Math · Module 2", "Math", "questions", 35, 22, { route: "advanced" }),
    ],
  },
  {
    id: "ielts-reading-academic-v2", exam: "IELTS", mode: "ielts-reading",
    title: "IELTS Academic Reading Practice",
    description: "Three original passages and 40 questions in a persistent 60-minute workspace.",
    version: 2, status: "active",
    stages: [stage("ielts-reading", "Academic Reading", "Reading", "questions", 60, 40)],
  },
  {
    id: "ielts-writing-academic-v2", exam: "IELTS", mode: "ielts-writing",
    title: "IELTS Academic Writing Practice",
    description: "Task 1 and Task 2 with autosaved drafts, word counts, and transparent practice feedback.",
    version: 2, status: "active",
    stages: [stage("ielts-writing", "Academic Writing", "Writing", "writing", 60, 2)],
  },
  {
    id: "ielts-listening-academic-v2", exam: "IELTS", mode: "ielts-listening",
    title: "IELTS Listening Practice",
    description: "Four original recordings and 40 questions with controlled playback and autosave.",
    version: 2, status: "active",
    stages: [stage("ielts-listening", "Listening", "Listening", "questions", 40, 40)],
  },
  {
    id: "ielts-speaking-academic-v2", exam: "IELTS", mode: "ielts-speaking",
    title: "IELTS Speaking Practice",
    description: "A three-part recorded speaking rehearsal with preparation timing and transcript notes.",
    version: 2, status: "active",
    stages: [stage("ielts-speaking", "Speaking", "Speaking", "speaking", 14, 3)],
  },
];

export const EXAM_STAGE_ITEMS_V2: Record<string, SeedItem[]> = {
  "sat-rw-m1": satReadingWriting("sat-rw-core", 27, 3, 0),
  "sat-rw-m2-standard": satReadingWriting("sat-rw-standard", 27, 3, 1),
  "sat-rw-m2-advanced": satReadingWriting("sat-rw-advanced", 27, 5, 2),
  "sat-break": [],
  "sat-math-m1": satMath("sat-math-core", 3, 0),
  "sat-math-m2-standard": satMath("sat-math-standard", 3, 1),
  "sat-math-m2-advanced": satMath("sat-math-advanced", 5, 2),
  "ielts-reading": IELTS_READING_ITEMS,
  "ielts-writing": IELTS_WRITING_ITEMS,
  "ielts-listening": IELTS_LISTENING_ITEMS,
  "ielts-speaking": IELTS_SPEAKING_ITEMS,
};

function bankMetadata(stageId: string, item: SeedItem) {
  const readingMatch = item.id.match(/^ielts-reading-(\d{2})$/);
  const stimulusGroupId = readingMatch
    ? `ielts-reading-passage-${Math.min(3, Math.floor((Number(readingMatch[1]) - 1) / 13) + 1)}`
    : item.stimulus?.kind === "audio" && item.stimulus.mediaUrl
      ? `ielts-listening-${item.stimulus.mediaUrl}`
      : item.id;
  return {
    ...item,
    eligibleStageIds: [stageId],
    stimulusGroupId,
    stimulusId: item.stimulus ? `stimulus-${stimulusGroupId}` : undefined,
  };
}

export const EXAM_ITEMS_V2 = Object.entries(EXAM_STAGE_ITEMS_V2)
  .flatMap(([stageId, items]) => items.map((item) => bankMetadata(stageId, item)));

export const EXAM_BLUEPRINT_BY_MODE = Object.fromEntries(
  EXAM_BLUEPRINTS_V2.map((blueprint) => [blueprint.mode, blueprint]),
) as Partial<Record<ExamMode, Blueprint>>;

export function snapshotItems(items: SeedItem[]): FormItemSnapshot[] {
  return items.map((item) => ({ ...item }));
}
