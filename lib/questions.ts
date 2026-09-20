export type Misconception = {
  id: string;
  label: string;
  feedback: string;
};

export type Choice = {
  id: string;
  value: string;
  misconception?: Misconception;
};

export type Question = {
  id: string;
  skill: string;
  eyebrow: string;
  prompt: string;
  latex?: string;
  visual?: { type: "fraction"; numerator: number; denominator: number };
  choices: Choice[];
  correctChoiceId: string;
  hint: string;
  explanation: string;
};

type Random = () => number;

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const integer = (random: Random, min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min;

function shuffled<T>(values: T[], random: Random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function numericChoices(
  correct: number,
  distractors: Array<[number, Misconception]>,
  random: Random,
): { choices: Choice[]; correctChoiceId: string } {
  const correctChoiceId = "correct";
  const unique = new Map<number, Misconception>();
  distractors.forEach(([value, misconception]) => {
    if (value !== correct && !unique.has(value)) unique.set(value, misconception);
  });

  let fallback = correct + 1;
  while (unique.size < 3) {
    if (fallback !== correct && !unique.has(fallback)) {
      unique.set(fallback, {
        id: "calculation-slip",
        label: "Calculation slip",
        feedback: "You were close. Recheck each step carefully.",
      });
    }
    fallback += 1;
  }

  return {
    correctChoiceId,
    choices: shuffled(
      [
        { id: correctChoiceId, value: String(correct) },
        ...[...unique.entries()].slice(0, 3).map(([value, misconception], index) => ({
          id: `distractor-${index}`,
          value: String(value),
          misconception,
        })),
      ],
      random,
    ),
  };
}

const misconceptions = {
  precedence: {
    id: "math.precedence.left-to-right",
    label: "Order of operations",
    feedback: "Try multiplication before addition — it gets priority.",
  },
  placeValue: {
    id: "math.place-value.column-alignment",
    label: "Place value",
    feedback: "Line up hundreds, tens, and ones before combining them.",
  },
  regrouping: {
    id: "math.subtraction.regrouping",
    label: "Regrouping",
    feedback: "When the top digit is smaller, regroup one ten first.",
  },
  divisionDirection: {
    id: "math.division.reversed",
    label: "Division direction",
    feedback: "Divide the total by the number in each equal group.",
  },
  fractionWhole: {
    id: "math.fraction.whole-versus-parts",
    label: "Fractions",
    feedback: "The denominator counts all equal parts, not just the shaded ones.",
  },
  denominatorAddition: {
    id: "math.fraction.add-denominators",
    label: "Like denominators",
    feedback: "When pieces are the same size, add the numerators and keep the denominator.",
  },
  perimeterArea: {
    id: "math.measurement.perimeter-versus-area",
    label: "Perimeter vs. area",
    feedback: "Perimeter is the distance around the outside, so add every side.",
  },
  decimalPlace: {
    id: "math.decimal.place-value",
    label: "Decimal place value",
    feedback: "Tenths are the first place to the right of the decimal point.",
  },
  elapsedHour: {
    id: "math.time.base-sixty",
    label: "Elapsed time",
    feedback: "Remember that an hour has 60 minutes, not 100.",
  },
  inverseOperation: {
    id: "math.word-problem.wrong-operation",
    label: "Choosing an operation",
    feedback: "The amount left is the starting amount minus what was used.",
  },
} satisfies Record<string, Misconception>;

type QuestionFactory = (random: Random, index: number) => Question;

const factories: QuestionFactory[] = [
  (random, index) => {
    const a = integer(random, 3, 9);
    const b = integer(random, 2, 7);
    const c = integer(random, 3, 8);
    const correct = a + b * c;
    return {
      id: `order-operations-${index}`,
      skill: "Order of operations",
      eyebrow: "Number sense · Level 3",
      prompt: "Solve the expression.",
      latex: `${a} + ${b} \\times ${c}`,
      ...numericChoices(correct, [[(a + b) * c, misconceptions.precedence], [a + b + c, misconceptions.precedence], [a * b + c, misconceptions.precedence]], random),
      hint: "Multiplication and division happen before addition and subtraction.",
      explanation: `${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${correct}.`,
    };
  },
  (random, index) => {
    const a = integer(random, 3, 7) * 100 + integer(random, 1, 8) * 10 + integer(random, 1, 8);
    const b = integer(random, 1, 2) * 100 + integer(random, 1, 8) * 10 + integer(random, 1, 8);
    const correct = a + b;
    return {
      id: `addition-${index}`,
      skill: "Multi-digit addition",
      eyebrow: "Arithmetic · Level 2",
      prompt: `What is ${a.toLocaleString()} + ${b.toLocaleString()}?`,
      ...numericChoices(correct, [[correct - 100, misconceptions.placeValue], [correct - 10, misconceptions.placeValue], [correct + 10, misconceptions.placeValue]], random),
      hint: "Stack the numbers and line up digits with the same place value.",
      explanation: `Adding each place-value column gives ${correct.toLocaleString()}.`,
    };
  },
  (random, index) => {
    const ones = integer(random, 2, 7);
    const bottomOnes = integer(random, ones + 1, 9);
    const top = integer(random, 4, 8) * 10 + ones;
    const bottom = integer(random, 1, 3) * 10 + bottomOnes;
    const correct = top - bottom;
    return {
      id: `subtraction-${index}`,
      skill: "Subtraction with regrouping",
      eyebrow: "Arithmetic · Level 2",
      prompt: `Find the difference: ${top} − ${bottom}`,
      ...numericChoices(correct, [[Math.abs((top % 10) - (bottom % 10)) + (Math.floor(top / 10) - Math.floor(bottom / 10)) * 10, misconceptions.regrouping], [correct + 10, misconceptions.regrouping], [top + bottom, misconceptions.inverseOperation]], random),
      hint: "Can you subtract the ones directly, or do you need to regroup a ten?",
      explanation: `Regroup one ten, subtract the ones, then the tens. The difference is ${correct}.`,
    };
  },
  (random, index) => {
    const groups = integer(random, 3, 9);
    const inGroup = integer(random, 3, 10);
    const total = groups * inGroup;
    return {
      id: `division-${index}`,
      skill: "Equal-group division",
      eyebrow: "Arithmetic · Level 2",
      prompt: `${total} markers are shared equally into ${groups} boxes. How many go in each box?`,
      ...numericChoices(inGroup, [[groups, misconceptions.divisionDirection], [total - groups, misconceptions.inverseOperation], [total + groups, misconceptions.inverseOperation]], random),
      hint: `Think: ${groups} × what number = ${total}?`,
      explanation: `${total} ÷ ${groups} = ${inGroup}, so each box gets ${inGroup} markers.`,
    };
  },
  (random, index) => {
    const denominator = [4, 6, 8][integer(random, 0, 2)];
    const possibleNumerators = Array.from({ length: denominator - 1 }, (_, value) => value + 1)
      .filter((value) => value * 2 !== denominator);
    const numerator = possibleNumerators[integer(random, 0, possibleNumerators.length - 1)];
    return {
      id: `fraction-model-${index}`,
      skill: "Reading fractions",
      eyebrow: "Fractions · Level 1",
      prompt: "What fraction of the bar is shaded?",
      visual: { type: "fraction", numerator, denominator },
      correctChoiceId: "correct",
      choices: shuffled([
        { id: "correct", value: `${numerator}/${denominator}` },
        { id: "distractor-0", value: `${denominator - numerator}/${denominator}`, misconception: misconceptions.fractionWhole },
        { id: "distractor-1", value: `${numerator}/${denominator - numerator}`, misconception: misconceptions.fractionWhole },
        { id: "distractor-2", value: `${denominator}/${numerator}`, misconception: misconceptions.fractionWhole },
      ], random),
      hint: "Count all equal pieces for the bottom number, then shaded pieces for the top.",
      explanation: `${numerator} of ${denominator} equal parts are shaded, so the fraction is ${numerator}/${denominator}.`,
    };
  },
  (random, index) => {
    const denominator = [5, 6, 8, 10][integer(random, 0, 3)];
    const left = integer(random, 1, Math.floor(denominator / 2));
    const right = integer(random, 1, denominator - left - 1);
    const sum = left + right;
    const multipliedNumerators = left * right === sum || left * right === sum + 1
      ? sum - 1
      : left * right;
    return {
      id: `fraction-addition-${index}`,
      skill: "Adding like fractions",
      eyebrow: "Fractions · Level 2",
      prompt: "Add the fractions.",
      latex: `\\frac{${left}}{${denominator}} + \\frac{${right}}{${denominator}}`,
      correctChoiceId: "correct",
      choices: shuffled([
        { id: "correct", value: `${sum}/${denominator}` },
        { id: "distractor-0", value: `${sum}/${denominator * 2}`, misconception: misconceptions.denominatorAddition },
        { id: "distractor-1", value: `${multipliedNumerators}/${denominator}`, misconception: misconceptions.denominatorAddition },
        { id: "distractor-2", value: `${sum + 1}/${denominator}`, misconception: misconceptions.denominatorAddition },
      ], random),
      hint: "The pieces are already the same size. What changes when you combine them?",
      explanation: `Keep the denominator ${denominator} and add ${left} + ${right}. The answer is ${sum}/${denominator}.`,
    };
  },
  (random, index) => {
    const width = integer(random, 3, 10);
    const height = integer(random, 2, 8);
    const correct = 2 * (width + height);
    return {
      id: `perimeter-${index}`,
      skill: "Rectangle perimeter",
      eyebrow: "Measurement · Level 2",
      prompt: `A garden is ${width} m long and ${height} m wide. What is its perimeter?`,
      ...numericChoices(correct, [[width * height, misconceptions.perimeterArea], [width + height, misconceptions.perimeterArea], [2 * width + height, misconceptions.perimeterArea]], random),
      hint: "Trace all four sides of the rectangle.",
      explanation: `${width} + ${height} + ${width} + ${height} = ${correct} metres.`,
    };
  },
  (random, index) => {
    const whole = integer(random, 2, 8);
    const tenth = integer(random, 1, 9);
    const correct = tenth / 10;
    return {
      id: `decimal-value-${index}`,
      skill: "Decimal place value",
      eyebrow: "Decimals · Level 2",
      prompt: `In the number ${whole}.${tenth}, what is the value of the digit ${tenth}?`,
      correctChoiceId: "correct",
      choices: shuffled([
        { id: "correct", value: correct.toFixed(1) },
        { id: "distractor-0", value: String(tenth), misconception: misconceptions.decimalPlace },
        { id: "distractor-1", value: (tenth / 100).toFixed(2), misconception: misconceptions.decimalPlace },
        { id: "distractor-2", value: String(tenth * 10), misconception: misconceptions.decimalPlace },
      ], random),
      hint: "Look at the first position immediately after the decimal point.",
      explanation: `${tenth} is in the tenths place, so its value is ${tenth}/10 or ${correct.toFixed(1)}.`,
    };
  },
  (random, index) => {
    const startHour = integer(random, 1, 9);
    const startMinute = [10, 15, 20, 25, 30][integer(random, 0, 4)];
    const duration = [25, 35, 45, 50][integer(random, 0, 3)];
    const endTotal = startHour * 60 + startMinute + duration;
    const endHour = Math.floor(endTotal / 60);
    const endMinute = endTotal % 60;
    const end = `${endHour}:${String(endMinute).padStart(2, "0")}`;
    const tenMinutesLate = `${Math.floor((endTotal + 10) / 60)}:${String((endTotal + 10) % 60).padStart(2, "0")}`;
    return {
      id: `elapsed-time-${index}`,
      skill: "Elapsed time",
      eyebrow: "Time · Level 2",
      prompt: `Practice starts at ${startHour}:${String(startMinute).padStart(2, "0")} and lasts ${duration} minutes. When does it end?`,
      correctChoiceId: "correct",
      choices: shuffled([
        { id: "correct", value: end },
        { id: "distractor-0", value: `${startHour}:${String(startMinute).padStart(2, "0")}`, misconception: misconceptions.elapsedHour },
        { id: "distractor-1", value: `${endHour + 1}:${String(endMinute).padStart(2, "0")}`, misconception: misconceptions.elapsedHour },
        { id: "distractor-2", value: tenMinutesLate, misconception: misconceptions.elapsedHour },
      ], random),
      hint: "Count up to the next hour first, then add the remaining minutes.",
      explanation: `Adding ${duration} minutes to the start time lands at ${end}.`,
    };
  },
  (random, index) => {
    const start = integer(random, 45, 90);
    const used = integer(random, 12, start - 10);
    const correct = start - used;
    return {
      id: `word-problem-${index}`,
      skill: "Subtraction word problems",
      eyebrow: "Problem solving · Level 2",
      prompt: `Mina collected ${start} stickers and used ${used} in a project. How many stickers are left?`,
      ...numericChoices(correct, [[start + used, misconceptions.inverseOperation], [used - correct, misconceptions.inverseOperation], [start, misconceptions.inverseOperation]], random),
      hint: "The collection gets smaller when some stickers are used.",
      explanation: `“Left” tells us to subtract: ${start} − ${used} = ${correct}.`,
    };
  },
];

export const QUESTION_TEMPLATE_COUNT = factories.length;

export function generateQuestions(seed = 20260919): Question[] {
  const random = seededRandom(seed);
  return factories.map((factory, index) => factory(random, index));
}
