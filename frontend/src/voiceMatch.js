/* =====================================================================
   BurnCare — voiceMatch.js
   ---------------------------------------------------------------------
   Turns what the patient SAID (text from the browser's speech
   recognition) into one of the answers on the form.
   No AI guessing: the words are matched against a fixed list, and if
   the match is not clear the answer is left alone (returns null).
   Works with English and Arabic words at the same time.
   Goes in src/voiceMatch.js
   ===================================================================== */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

// Lower-case, remove Arabic marks, make similar letters equal, drop punctuation.
export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// words  = a phrase found anywhere in the sentence
// tokens = must be a whole word (for short words that could hide inside others)
// The keys are the exact answer texts used in PatientEntry.jsx.
const SYN = {
  // ----- yes / no -----
  Yes: { tokens: ["yes", "yeah", "yep", "yup", "sure", "نعم", "ايوه", "ايوا", "اي", "بلي", "اجل", "صح", "طبعا"] },
  No: { tokens: ["no", "nope", "nah", "لا", "كلا", "ما", "مو", "مب", "مش", "ليس"] },
  "Not sure": {
    words: [
      "not sure", "unsure", "dont know", "do not know", "maybe", "not certain",
      "ما ادري", "مدري", "لا ادري", "مو متاكد", "مب متاكد", "مش متاكد", "ما اعرف", "لا اعرف", "ما اعلم", "يمكن", "ممكن",
    ],
  },

  // ----- cause -----
  "Hot liquid or steam": {
    words: [
      "hot liquid", "steam", "boiling", "hot water", "scald", "hot tea", "hot coffee", "hot oil", "hot soup", "hot milk",
      "سائل", "بخار", "ماء حار", "ماء ساخن", "ماء مغلي", "مويه حاره", "مويه ساخنه", "مويه مغليه", "ماي حار", "ماي ساخن",
      "شاي", "قهوه", "زيت", "شوربه", "مرق", "حليب", "مغلي",
    ],
  },
  "Fire or flame": {
    words: ["fire", "flame", "campfire", "لهب", "حريق", "اشتعل", "شعله"],
    tokens: ["نار", "النار", "بالنار"],
  },
  "Hot object": {
    words: [
      "hot object", "hot metal", "exhaust", "جسم ساخن", "شيء ساخن", "شي ساخن", "جسم حار",
      "مكواه", "مقلاه", "موقد", "بوتجاز", "سخان", "حديد", "عادم", "صاج",
    ],
    tokens: ["pan", "pot", "iron", "stove", "oven", "heater", "metal", "قدر", "فرن", "معدن"],
  },
  Electricity: {
    words: ["electric", "كهرب", "صعق", "تيار"],
    tokens: ["wire", "socket", "shock"],
  },
  Chemical: {
    words: [
      "chemical", "acid", "bleach", "chlorine", "detergent", "cleaner", "caustic",
      "كيماو", "كيميا", "حمض", "تيزاب", "كلور", "مبيض", "منظف", "قلوي", "صودا", "اسيد",
    ],
  },
  Friction: {
    words: ["friction", "rubbing", "carpet burn", "treadmill", "احتكاك", "احتك", "فرك", "حبل", "سحج", "سجاد"],
    tokens: ["rope", "rub"],
  },
  "Cold injury (frostbite)": {
    words: ["frostbite", "frost", "freez", "cold injury", "dry ice", "تجمد", "تجميد", "صقيع", "ثلج", "برد", "بارد", "جليد", "قضمه"],
    tokens: ["ice"],
  },
  Sun: {
    words: ["sunburn", "sun burn", "sunlight", "tanning", "شمس", "تشمس"],
    tokens: ["sun"],
  },
  Other: {
    words: ["something else", "غير ذلك", "شي ثاني", "شيء اخر", "شي اخر", "غيرها"],
    tokens: ["other", "اخر", "اخري"],
  },

  // ----- long-term conditions -----
  Diabetes: { words: ["diabet", "sugar", "سكر"] },
  "Heart or blood vessel disease": {
    words: ["heart", "cardiac", "blood vessel", "vascular", "stroke", "قلب", "شريان", "شرايين", "اوعيه", "جلطه", "ذبحه"],
  },
  "Kidney disease": {
    words: ["kidney", "renal", "dialysis", "كليه", "كليت", "كلويه", "كلوي", "الكلي", "كلاوي", "غسيل كلي"],
  },
  "Weak immune system": {
    words: ["immune", "immunity", "chemo", "cancer", "transplant", "steroid", "مناعه", "ايدز", "سرطان", "زراعه", "كورتيزون", "علاج كيماوي"],
    tokens: ["hiv"],
  },
  None: {
    words: [
      "no condition", "no medical", "nothing", "healthy", "none",
      "لا يوجد", "ما عندي", "ما عنده", "ما عندها", "ما فيه", "ما في", "لا شي", "ولا شي", "سليم",
      "بدون", "ما اعاني", "لا اعاني", "لا يعاني", "ما يعاني", "ما تعاني",
    ],
  },
};

// How well one answer matches the sentence: the length of the longest match (0 = no match).
function score(text, option) {
  const syn = SYN[option];
  if (!syn) return 0;
  const tokens = text.split(" ");
  let best = 0;
  for (const word of syn.words || []) if (text.includes(word)) best = Math.max(best, word.length);
  for (const token of syn.tokens || []) if (tokens.includes(token)) best = Math.max(best, token.length);
  return best;
}

// One answer from a list (Yes/No, cause ...). Not clear → null.
function matchSingle(text, options) {
  const ranked = options
    .map((option) => ({ option, points: score(text, option) }))
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points);
  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].points - ranked[1].points < 2) return null; // two answers → don't guess
  return ranked[0].option;
}

// Several answers (long-term conditions). Not clear → null.
function matchMulti(text, options) {
  if (/^(no|nope|لا|كلا)$/.test(text)) return options.includes("None") ? ["None"] : null;
  const hits = options.filter((option) => score(text, option) > 0);
  if (!hits.length) return null;
  if (hits.includes("None") && hits.length > 1) return null; // "none" together with a condition → unclear
  return hits;
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
  واحد: 1, سنه: 1, سنتين: 2, اثنين: 2, اثنان: 2, ثلاث: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5,
  ست: 6, سته: 6, سبع: 7, سبعه: 7, ثمان: 8, ثمانيه: 8, تسع: 9, تسعه: 9, عشر: 10, عشره: 10,
};
const TEENS_AR = { احد: 11, احدي: 11, اثنا: 12, اثني: 12, ثلاث: 13, ثلاثه: 13, اربع: 14, اربعه: 14, خمس: 15, خمسه: 15, ست: 16, سته: 16 };
const SHORT_TIME = ["شهر", "اشهر", "شهور", "اسبوع", "اسابيع", "يوم", "ايام", "month", "months", "week", "weeks", "day", "days"];
const BABY = ["newborn", "baby", "infant", "رضيع", "مولود"];
const ADULT_WORDS = ["adult", "بالغ", "بالغه", "راشد"];

// The age said by the patient → one of the 6 age groups (same order as AGE_GROUPS).
function matchAge(text, options) {
  if (options.length !== 6) return null;
  const tokens = text.split(" ");
  let years = null;

  const digits = text.match(/\d+/);
  if (digits) years = Number(digits[0]);
  if (years === null) {
    for (let i = 0; i < tokens.length; i++) {
      if ((tokens[i] === "عشر" || tokens[i] === "عشره") && TEENS_AR[tokens[i - 1]]) {
        years = TEENS_AR[tokens[i - 1]];
        break;
      }
    }
  }
  if (years === null) {
    const word = tokens.find((t) => NUMBER_WORDS[t] !== undefined);
    if (word) years = NUMBER_WORDS[word];
  }

  if (years !== null && years > 120) return null;
  if (years !== null && tokens.some((t) => SHORT_TIME.includes(t))) return options[0]; // months / weeks / days
  if (years === null) {
    if (tokens.some((t) => BABY.includes(t))) return options[0];
    if (tokens.some((t) => ADULT_WORDS.includes(t))) return options[5];
    return null;
  }
  if (years < 1) return options[0];
  if (years < 5) return options[1];
  if (years < 10) return options[2];
  if (years < 15) return options[3];
  if (years === 15) return options[4];
  return options[5];
}

// kind: "age" | "single" | "multi". Returns the answer (a text, or a list for "multi") or null.
export function matchAnswer(kind, spoken, options) {
  const text = normalize(spoken);
  if (!text) return null;
  if (kind === "age") return matchAge(text, options);
  if (kind === "multi") return matchMulti(text, options);
  return matchSingle(text, options);
}
