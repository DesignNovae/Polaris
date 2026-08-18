/**
 * Polaris-authored companion tracks.
 *
 * These are NOT verbatim transcripts of the third-party lessons - Polaris does not
 * own that audio and will not claim words it cannot verify. Each track is an
 * editorially written study companion, aligned to the lesson timeline, that says
 * what the learner should be taking from each stretch of the video.
 *
 * They are marked `authored-companion` everywhere they surface, and the panel says
 * so in plain language. When a real caption track becomes available for a lesson,
 * a higher-ranked provider supplies it and these are never consulted.
 *
 * Copy is written in short declaratives on purpose: short declaratives segment
 * cleanly and translate into readable sign sequences. Long subordinate clauses do
 * not, in any sign language.
 */

export type CompanionCue = { at: number; until: number; text: string };

export type CompanionTrack = {
  mediaId: string;
  language: string;
  duration: number;
  cues: CompanionCue[];
};

export const COMPANION_TRACKS: Record<string, CompanionTrack> = {
  "ielts-listening-topics": {
    mediaId: "ielts-listening-topics",
    language: "en-GB",
    duration: 372,
    cues: [
      { at: 0, until: 9, text: "This lesson covers the four parts of the IELTS Listening test." },
      { at: 9, until: 20, text: "You hear each recording one time only. There is no replay." },
      { at: 20, until: 33, text: "Part one is a conversation about an everyday subject. Two speakers talk." },
      { at: 33, until: 46, text: "Part two is a monologue. One person describes a place or a plan." },
      { at: 46, until: 60, text: "Part three returns to conversation. Students discuss academic work." },
      { at: 60, until: 73, text: "Part four is an academic lecture. This part is the hardest." },
      { at: 73, until: 88, text: "Read the questions before the recording starts. Use the pause." },
      { at: 88, until: 103, text: "Underline the key words in every question. Names, numbers, and dates matter." },
      { at: 103, until: 119, text: "Speakers often correct themselves. The second answer is the right one." },
      { at: 119, until: 134, text: "Watch your spelling. A correct answer spelled wrongly scores zero." },
      { at: 134, until: 150, text: "Check the word limit. Three words means three words, never four." },
      { at: 150, until: 166, text: "Write your answers as you listen. Do not wait until the end." },
      { at: 166, until: 182, text: "Never leave a blank. An empty answer cannot earn a mark. A guess can." },
      { at: 182, until: 200, text: "You get ten minutes at the end to copy answers to the answer sheet." },
      { at: 200, until: 218, text: "Practise with a range of accents. British, Australian, and North American voices all appear." },
      { at: 218, until: 240, text: "Listen to something in English every day. Build the habit before the test." },
    ],
  },

  "ielts-reading-types": {
    mediaId: "ielts-reading-types",
    language: "en-GB",
    duration: 420,
    cues: [
      { at: 0, until: 10, text: "The Academic Reading test has three passages and forty questions." },
      { at: 10, until: 22, text: "You have sixty minutes. That is twenty minutes for each passage." },
      { at: 22, until: 36, text: "There is no extra transfer time. Write answers on the sheet as you go." },
      { at: 36, until: 52, text: "Matching headings asks you to find the main idea of each paragraph." },
      { at: 52, until: 68, text: "For headings, read the first and last sentence of the paragraph first." },
      { at: 68, until: 84, text: "True, false, not given questions test the claims the writer makes." },
      { at: 84, until: 102, text: "False means the passage contradicts the statement. Not given means the passage is silent." },
      { at: 102, until: 118, text: "Do not use your own knowledge. Use only what the passage says." },
      { at: 118, until: 136, text: "Sentence completion questions follow the order of the passage." },
      { at: 136, until: 152, text: "Matching features questions do not follow the order. Scan for names." },
      { at: 152, until: 170, text: "Skim the passage first for structure. Do not read every word." },
      { at: 170, until: 188, text: "Then scan for the specific detail each question needs." },
      { at: 188, until: 208, text: "The questions paraphrase the passage. Look for meaning, not matching words." },
      { at: 208, until: 228, text: "If a question takes more than ninety seconds, move on and come back." },
      { at: 228, until: 250, text: "Every question is worth one mark. A hard question is not worth more." },
    ],
  },

  "ielts-writing-task2": {
    mediaId: "ielts-writing-task2",
    language: "en-GB",
    duration: 480,
    cues: [
      { at: 0, until: 12, text: "Task two is an essay. It is worth twice the marks of task one." },
      { at: 12, until: 26, text: "Write at least two hundred and fifty words in forty minutes." },
      { at: 26, until: 42, text: "Spend five minutes planning. A plan saves time later." },
      { at: 42, until: 58, text: "Read the question twice. Answer the question that was asked." },
      { at: 58, until: 76, text: "Four criteria are marked. Task response, coherence, vocabulary, and grammar." },
      { at: 76, until: 94, text: "Task response means you answered every part of the question." },
      { at: 94, until: 112, text: "The introduction should paraphrase the question and state your position." },
      { at: 112, until: 132, text: "Each body paragraph needs one main idea. State it in the first sentence." },
      { at: 132, until: 152, text: "Support that idea with an explanation and one specific example." },
      { at: 152, until: 172, text: "A general example is weak. A concrete example is strong." },
      { at: 172, until: 192, text: "Link your ideas, but do not overuse linking words. Overuse lowers the score." },
      { at: 192, until: 212, text: "The conclusion restates your position. Add no new ideas there." },
      { at: 212, until: 234, text: "Use a range of sentence structures. Every sentence the same length scores low." },
      { at: 234, until: 256, text: "Accuracy matters more than complexity. A correct simple sentence beats a broken complex one." },
      { at: 256, until: 278, text: "Leave two minutes to check your work. Look for articles and verb endings." },
      { at: 278, until: 300, text: "Write the essay by hand if you take the paper test. Practise that way too." },
    ],
  },

  "ielts-writing-overview": {
    mediaId: "ielts-writing-overview",
    language: "en-GB",
    duration: 300,
    cues: [
      { at: 0, until: 12, text: "The Writing test has two tasks and lasts sixty minutes." },
      { at: 12, until: 26, text: "Task one takes twenty minutes. Task two takes forty." },
      { at: 26, until: 42, text: "In Academic task one you describe a chart, a table, or a process." },
      { at: 42, until: 58, text: "Write at least one hundred and fifty words for task one." },
      { at: 58, until: 76, text: "Report the main trends. Do not explain why they happened." },
      { at: 76, until: 94, text: "Select the important features. Do not list every number." },
      { at: 94, until: 112, text: "Compare where the data invites comparison. Highest, lowest, fastest change." },
      { at: 112, until: 132, text: "Task two is an essay on an argument or a problem." },
      { at: 132, until: 152, text: "Do task two first if you find essays harder. It carries more marks." },
      { at: 152, until: 174, text: "Never memorise a whole essay. Examiners recognise memorised text and penalise it." },
      { at: 174, until: 196, text: "Practise under the clock. Timing is the skill most candidates lack." },
    ],
  },

  "ielts-fluency": {
    mediaId: "ielts-fluency",
    language: "en-GB",
    duration: 240,
    cues: [
      { at: 0, until: 12, text: "Fluency and coherence is one quarter of your speaking score." },
      { at: 12, until: 28, text: "Fluency means speaking at a natural speed without long pauses." },
      { at: 28, until: 44, text: "It does not mean speaking fast. Speed is not the target." },
      { at: 44, until: 62, text: "Coherence means your ideas connect and the listener can follow." },
      { at: 62, until: 80, text: "Extend your answers. A one sentence answer cannot show your range." },
      { at: 80, until: 100, text: "In part one, give an answer and then a reason." },
      { at: 100, until: 120, text: "In part two you speak for two minutes. Use the one minute to plan." },
      { at: 120, until: 142, text: "If you lose your place, say so naturally and continue." },
      { at: 142, until: 162, text: "Self correction is normal. Correcting yourself once is fine." },
      { at: 162, until: 184, text: "Repeating the same correction over and over lowers the score." },
      { at: 184, until: 206, text: "Record yourself speaking for two minutes. Listen for your pauses." },
    ],
  },

  "sat-rw-synthesis": {
    mediaId: "sat-rw-synthesis",
    language: "en-US",
    duration: 300,
    cues: [
      { at: 0, until: 12, text: "Rhetorical synthesis questions give you notes and a goal." },
      { at: 12, until: 28, text: "The notes are bullet points a student gathered for a project." },
      { at: 28, until: 44, text: "The goal sentence tells you exactly what the answer must do." },
      { at: 44, until: 62, text: "Read the goal first. Read it before you read the notes." },
      { at: 62, until: 80, text: "The goal is the only thing that decides the right answer." },
      { at: 80, until: 100, text: "Three choices will be true statements that miss the goal." },
      { at: 100, until: 120, text: "A true statement is not a correct answer here. Accuracy is not enough." },
      { at: 120, until: 142, text: "Underline the key words in the goal. Emphasize, compare, introduce." },
      { at: 142, until: 164, text: "If the goal says compare, the answer must mention both things." },
      { at: 164, until: 186, text: "If the goal says introduce, the answer must work for a reader who knows nothing." },
      { at: 186, until: 210, text: "Check each choice against the goal, one at a time." },
      { at: 210, until: 234, text: "Cross out any choice that uses information not in the notes." },
    ],
  },

  "sat-math-linear-basic": {
    mediaId: "sat-math-linear-basic",
    language: "en-US",
    duration: 240,
    cues: [
      { at: 0, until: 12, text: "Linear equations are the most common topic on SAT Math." },
      { at: 12, until: 28, text: "A linear equation graphs as a straight line." },
      { at: 28, until: 46, text: "Slope intercept form is y equals m x plus b." },
      { at: 46, until: 64, text: "In that form, m is the slope and b is the y intercept." },
      { at: 64, until: 84, text: "Slope is the rate of change. Rise over run." },
      { at: 84, until: 104, text: "A positive slope rises to the right. A negative slope falls." },
      { at: 104, until: 126, text: "Parallel lines have the same slope and different intercepts." },
      { at: 126, until: 148, text: "Perpendicular lines have slopes that multiply to negative one." },
      { at: 148, until: 170, text: "In a word problem, the slope is the per unit rate." },
      { at: 170, until: 192, text: "The intercept is the starting value before anything changes." },
      { at: 192, until: 216, text: "Name your variables before you write the equation. It prevents most errors." },
    ],
  },

  "sat-math-volume-basic": {
    mediaId: "sat-math-volume-basic",
    language: "en-US",
    duration: 210,
    cues: [
      { at: 0, until: 12, text: "Volume questions give you the formulas on the reference sheet." },
      { at: 12, until: 30, text: "You do not need to memorize them, but knowing them saves time." },
      { at: 30, until: 50, text: "The volume of a rectangular box is length times width times height." },
      { at: 50, until: 70, text: "The volume of a cylinder is pi times radius squared times height." },
      { at: 70, until: 92, text: "The radius is half the diameter. Many errors start right there." },
      { at: 92, until: 114, text: "Check your units before you calculate. Convert everything first." },
      { at: 114, until: 138, text: "If a length doubles, the volume grows by a factor of eight." },
      { at: 138, until: 162, text: "Read what the question asks for. Sometimes it wants the height, not the volume." },
      { at: 162, until: 188, text: "Write the formula down before substituting. Then substitute one value at a time." },
    ],
  },
};

export function hasCompanionTrack(mediaId: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMPANION_TRACKS, mediaId);
}
