import type { DbExamBlueprint, DbExamItem, SatMathDomain } from "@/lib/exams/types";

const choices = (...labels: string[]) => labels.map((label, index) => ({
  id: String.fromCharCode(65 + index),
  label,
}));

type SeedItem = Omit<
  DbExamItem,
  "createdAt" | "updatedAt" | "eligibleStageIds" | "stimulusGroupId" | "stimulusId"
>;

const item = (
  id: string,
  domain: SatMathDomain,
  skill: string,
  difficulty: number,
  prompt: string,
  optionLabels: string[] | null,
  answer: string | string[],
  explanation: string,
): SeedItem => ({
  id,
  exam: "SAT",
  section: "Math",
  itemType: optionLabels ? "multiple-choice" : "student-produced-response",
  domain,
  skill,
  difficulty,
  prompt,
  options: optionLabels ? choices(...optionLabels) : undefined,
  correctAnswer: optionLabels
    ? { kind: "choice", value: String(answer) }
    : { kind: "numeric", accepted: Array.isArray(answer) ? answer : [answer] },
  explanation,
  estimatedTimeSeconds: 95,
  tags: [domain.toLowerCase().replace(/\W+/g, "-"), skill.toLowerCase().replace(/\W+/g, "-")],
  status: "approved",
  version: 1,
  provenance: "polaris-original-seed-v1",
});

export const SAT_MATH_SEED_ITEMS: SeedItem[] = [
  item("sat-math-a01", "Algebra", "Linear equations in one variable", 2, "What value of x satisfies 3x + 7 = 25?", ["4", "5", "6", "8"], "C", "Subtract 7 from both sides to get 3x = 18, then divide by 3."),
  item("sat-math-a02", "Algebra", "Linear functions", 2, "The function y = 2x - 5 models a relationship. What is y when x = 7?", ["7", "9", "12", "14"], "B", "Substitute 7 for x: y = 2(7) - 5 = 9."),
  item("sat-math-a03", "Algebra", "Systems of linear equations", 3, "The equations x + y = 10 and x - y = 4 form a system. What is the value of x?", ["3", "6", "7", "14"], "C", "Adding the equations gives 2x = 14, so x = 7."),
  item("sat-math-a04", "Algebra", "Slope", 3, "A line passes through (2, 5) and (6, 13). What is the slope of the line?", ["1/2", "2", "4", "8"], "B", "The slope is (13 - 5)/(6 - 2) = 8/4 = 2."),
  item("sat-math-a05", "Algebra", "Linear models", 3, "A taxi ride costs $4 plus $2.50 per mile. If the total is $24, how many miles was the ride?", ["6", "8", "9.6", "11.2"], "B", "Solve 4 + 2.5m = 24. Then 2.5m = 20 and m = 8."),
  item("sat-math-a06", "Algebra", "Linear inequalities", 3, "Which inequality is equivalent to 5x - 3 > 17?", ["x > 4", "x < 4", "x > 14/5", "x < 14/5"], "A", "Add 3 to get 5x > 20, then divide by 5."),
  item("sat-math-a07", "Algebra", "Function notation", 2, "If f(x) = 3x + 2, what is f(-4)?", ["-14", "-10", "10", "14"], "B", "f(-4) = 3(-4) + 2 = -12 + 2 = -10."),
  item("sat-math-a08", "Algebra", "Equivalent equations", 3, "Enter the value of x that satisfies 2(x - 3) = 18.", null, ["12", "12.0"], "Divide by 2 to get x - 3 = 9, then add 3."),
  item("sat-math-m01", "Advanced Math", "Quadratic equations", 4, "The equation x² - 9x + 20 = 0 has two solutions. What is the smaller solution?", ["-5", "-4", "4", "5"], "C", "The expression factors as (x - 4)(x - 5), so the smaller solution is 4."),
  item("sat-math-m02", "Advanced Math", "Exponential equations", 3, "If 2ˣ = 32, what is the value of x?", ["4", "5", "16", "30"], "B", "Because 32 = 2⁵, x = 5."),
  item("sat-math-m03", "Advanced Math", "Polynomial evaluation", 3, "For p(x) = x² + 3x - 4, what is p(2)?", ["2", "4", "6", "10"], "C", "p(2) = 2² + 3(2) - 4 = 4 + 6 - 4 = 6."),
  item("sat-math-m04", "Advanced Math", "Equivalent expressions", 4, "For x ≠ 4, the expression (x² - 16)/(x - 4) is equivalent to which expression?", ["x - 4", "x + 4", "x² + 4", "1"], "B", "Factor x² - 16 as (x - 4)(x + 4), then cancel x - 4."),
  item("sat-math-m05", "Advanced Math", "Quadratic functions", 4, "What is the minimum value of y = (x - 3)² - 7?", ["-10", "-7", "3", "7"], "B", "The squared term is smallest at 0, so the minimum y-value is -7."),
  item("sat-math-m06", "Advanced Math", "Radical equations", 4, "Enter the value of x that satisfies √(x + 5) = 4.", null, ["11", "11.0"], "Square both sides to get x + 5 = 16, so x = 11."),
  item("sat-math-m07", "Advanced Math", "Exponential growth", 4, "A population of 200 increases by 10% each year. What is the population after 2 years?", ["220", "240", "242", "260"], "C", "Use 200(1.10)² = 242."),
  item("sat-math-m08", "Advanced Math", "Solutions of quadratic equations", 4, "What is the sum of all real solutions to x² = 49?", ["-14", "0", "7", "14"], "B", "The solutions are -7 and 7, whose sum is 0."),
  item("sat-math-p01", "Problem-Solving and Data Analysis", "Percent change", 3, "A quantity increases from 80 to 100. What is the percent increase?", ["20%", "25%", "80%", "125%"], "B", "The increase is 20, and 20/80 = 0.25 = 25%."),
  item("sat-math-p02", "Problem-Solving and Data Analysis", "Mean", 2, "What is the mean of 4, 7, 9, and 10?", ["7", "7.5", "8", "8.5"], "B", "The sum is 30 and 30/4 = 7.5."),
  item("sat-math-p03", "Problem-Solving and Data Analysis", "Ratios", 3, "A box contains red and blue tokens in a ratio of 3:5. If there are 40 blue tokens, how many red tokens are there?", null, ["24", "24.0"], "Five ratio parts represent 40, so each part is 8 and three parts equal 24."),
  item("sat-math-g01", "Geometry and Trigonometry", "Triangle angles", 3, "The angle measures of a triangle are 2x°, 3x°, and 4x°. What is x?", ["15", "20", "30", "45"], "B", "Triangle angles sum to 180°, so 9x = 180 and x = 20."),
  item("sat-math-g02", "Geometry and Trigonometry", "Circle area", 2, "A circle has radius 6. What is its area?", ["6π", "12π", "36π", "72π"], "C", "Area is πr² = π(6²) = 36π."),
  item("sat-math-g03", "Geometry and Trigonometry", "Right triangles", 3, "A right triangle has legs of length 9 and 12. Enter the length of its hypotenuse.", null, ["15", "15.0"], "By the Pythagorean theorem, c = √(9² + 12²) = √225 = 15."),
];

export const SAT_MATH_BLUEPRINT: Omit<DbExamBlueprint, "createdAt" | "updatedAt"> = {
  id: "sat-math-module-v1",
  exam: "SAT",
  mode: "sat-math-module",
  title: "SAT Math Module Practice",
  description: "One unofficial 35-minute SAT-style Math module using original Polaris questions.",
  version: 1,
  status: "active",
  stages: [{
    id: "math-module",
    title: "Math Module",
    section: "Math",
    kind: "questions",
    durationSeconds: 35 * 60,
    questionCount: 22,
    domainCounts: {
      "Algebra": 8,
      "Advanced Math": 8,
      "Problem-Solving and Data Analysis": 3,
      "Geometry and Trigonometry": 3,
    },
  }],
};
