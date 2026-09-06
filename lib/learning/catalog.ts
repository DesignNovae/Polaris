import catalog from "@/data/learning/catalog.json";
import type { LearningPath, LibraryVideo } from "./library";

export const LEARNING_LIBRARY = catalog as LibraryVideo[];
export const LEARNING_SECTIONS = {
  IELTS: ["Listening", "Reading", "Writing", "Speaking"],
  SAT: ["Reading and Writing", "Math"],
} as const;
export const LEARNING_PATHS: LearningPath[] = [
  { id: "listening-start", title: "IELTS Listening essentials", description: "Get familiar with the test, build a listening strategy, then practise a recording.", exam: "IELTS", videoIds: ["lesson-IDYfKnGcei4", "lesson-7UZi4B6r0WU", "lesson-gfTqr_9BMjs", "lesson-vpmJTSntyVw", "ielts-listening-test"] },
  { id: "reading-evidence", title: "Read for evidence", description: "Explore question types, distinguish evidence from assumptions, and practise True, False, Not Given.", exam: "IELTS", videoIds: ["ielts-reading-improve", "ielts-reading-types", "lesson-WYl9PX7Ua_Q", "lesson-JkWwZt8UwA4", "lesson-hoOVjmKf_xw"] },
  { id: "writing-task2", title: "Build your Task 2 essay", description: "Move from understanding the task to structuring and developing a complete essay.", exam: "IELTS", videoIds: ["lesson-yvt8RzGNhBc", "ielts-writing-task2", "ielts-writing-opinion", "lesson-GGUSG6HYF5w", "lesson-x-_vHUzm3b4"] },
  { id: "speaking-confidence", title: "Develop your speaking answers", description: "Practise introduction questions, the long turn, and fluency before watching a mock test.", exam: "IELTS", videoIds: ["lesson-Wuxt-NzrHLk", "ielts-vocabulary", "lesson-u0BuspOplJw", "lesson-8H-WeY9GSf8", "lesson-cQ-kYU3uSP0"] },
  { id: "sat-algebra", title: "SAT algebra foundations", description: "Strengthen the underlying skills: linear equations, systems, functions, and quadratics.", exam: "SAT", videoIds: ["sat-math-linear", "sat-math-systems", "lesson-kvGsIo1TmsM", "lesson-kITJ6qH7jS0", "sat-math-quadratic", "lesson-6WMZ7J0wwMI"] },
  { id: "sat-reading-writing", title: "SAT reading and sentence skills", description: "Build reading foundations, support an inference, and connect ideas with accurate punctuation.", exam: "SAT", videoIds: ["sat-rw-evidence", "sat-rw-inference", "lesson-4fMipjAnlRk", "sat-rw-semicolon", "lesson-0yZ0ehTLxoo", "sat-rw-syntax", "lesson-xvhccF_tkIE"] },
];
