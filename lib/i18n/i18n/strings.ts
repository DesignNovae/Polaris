export type Lang = "en" | "bn";

type AnyDict = {
  nav: { product: string; pricing: string; howItWorks: string; tryIt: string };
  hero: {
    kicker: string;
    title1: string;
    titleAccent: string;
    title2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    stat1: string;
    stat1Label: string;
    stat2: string;
    stat2Label: string;
    stat3: string;
    stat3Label: string;
  };
  problem: {
    eyebrow: string;
    title: string;
    body: string;
    p1Title: string;
    p1: string;
    p2Title: string;
    p2: string;
    p3Title: string;
    p3: string;
  };
  how: {
    eyebrow: string;
    title: string;
    step1Title: string;
    step1: string;
    step2Title: string;
    step2: string;
    step3Title: string;
    step3: string;
    step4Title: string;
    step4: string;
  };
  // Plan names, prices, and feature lists come from the central catalog
  // (lib/billing/plans.ts) - the i18n layer only holds section chrome.
  pricing: {
    eyebrow: string;
    title: string;
    ctaFree: string;
    ctaPro: string;
    ctaElite: string;
  };
  onboard: {
    title: string;
    subtitle: string;
    q1: string;
    q1opts: readonly string[];
    q2: string;
    q2opts: readonly string[];
    q3: string;
    q3opts: readonly string[];
    q4: string;
    q4hint: string;
    q5: string;
    q5opts: readonly string[];
    q6: string;
    q6opts: readonly string[];
    submit: string;
    working: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    next30: string;
    summary: string;
    gaps: string;
    tryUni: string;
    empty: string;
    runIntake: string;
    regenerate: string;
    categories: Record<string, string>;
    priority: { high: string; medium: string; low: string };
  };
  uni: {
    title: string;
    subtitle: string;
    probability: string;
    whyTitle: string;
    whyHint: string;
    simTitle: string;
    simHint: string;
    gpa: string;
    test: string;
    ecCount: string;
    research: string;
    backToList: string;
  };
  ethics: { title: string; body: string };
  footer: { tagline: string; built: string };
  lang: { en: string; bn: string };
};

export const strings: Record<Lang, AnyDict> = {
  en: {
    nav: {
      product: "Product",
      pricing: "Pricing",
      howItWorks: "How it works",
      tryIt: "Try the AI Strategist",
    },
    hero: {
      kicker: "AI Academic Strategist",
      title1: "Your AI",
      titleAccent: "North Star",
      title2: "for elite admissions.",
      subtitle:
        "Polaris reverse-engineers the exact profile top universities accept. From early schooling to graduate school - one personalized, data-driven roadmap.",
      ctaPrimary: "Start your roadmap",
      ctaSecondary: "See how it works",
      stat1: "20+",
      stat1Label: "universities benchmarked",
      stat2: "6–18 mo",
      stat2Label: "actionable roadmaps",
      stat3: "BD + Global",
      stat3Label: "first-class localization",
    },
    problem: {
      eyebrow: "The Problem",
      title: "Smart students apply blind.",
      body:
        "85% of students in Bangladesh - and millions globally - navigate university admissions with fragmented Reddit threads, paid consultants ($2,000+), and pure guesswork. Top-tier admissions reward strategy, not luck. Polaris democratizes that strategy.",
      p1Title: "Fragmented information",
      p1: "Forum threads, outdated blogs, and contradictory advice.",
      p2Title: "Inaccessible counseling",
      p2: "Elite consultants cost more than a year of tuition.",
      p3Title: "No measurable feedback",
      p3: "Students never see their actual standing against admitted applicants.",
    },
    how: {
      eyebrow: "How it works",
      title: "From profile to acceptance, end-to-end.",
      step1Title: "1 · Intake",
      step1: "Six smart questions capture your grade, country, goals, GPA, activities, and target tier.",
      step2Title: "2 · AI Strategist",
      step2: "Gemma 4 generates a structured, quarter-by-quarter roadmap grounded in retrieval-augmented university data.",
      step3Title: "3 · Probability Engine",
      step3: "A trained ML model scores your acceptance chance against historical admit data - with transparent factors.",
      step4Title: "4 · Scenario Sim",
      step4: "Move a slider, see your odds shift. Optimize the next 6–18 months before you spend them.",
    },
    pricing: {
      eyebrow: "Pricing",
      title: "Strategy at every tier.",
      ctaFree: "Start free",
      ctaPro: "Get Pro",
      ctaElite: "Go Elite",
    },
    onboard: {
      title: "Build my roadmap",
      subtitle: "Six quick questions. Your AI strategist takes it from there.",
      q1: "What's your current grade level?",
      q1opts: ["Middle school (6–8)", "Early high school (9–10)", "Late high school (11–12)", "Undergraduate", "Recent graduate"],
      q2: "Where are you based?",
      q2opts: ["Bangladesh", "India", "Pakistan", "Nepal", "Other South Asia", "Other"],
      q3: "Target degree?",
      q3opts: ["Undergraduate (Bachelor's)", "Master's", "PhD", "Still deciding"],
      q4: "Current academic standing (GPA or equivalent)",
      q4hint: "Use a 0–4.0 scale. Estimate is fine.",
      q5: "Which categories describe your current activities? (pick all that apply)",
      q5opts: ["Olympiads / competitions", "Research / projects", "Leadership / clubs", "Community / volunteer", "Sports / arts", "Internships / work"],
      q6: "Target university tier?",
      q6opts: ["Top global (Ivy / Oxbridge / MIT-tier)", "Top 50 global", "Strong international (top 200)", "Regional strong programs"],
      submit: "Generate my roadmap",
      working: "Polaris is reverse-engineering your strategy…",
    },
    dashboard: {
      title: "Your Polaris Roadmap",
      subtitle: "Reverse-engineered from your profile and the admit patterns of similar students.",
      next30: "Next 30 days",
      summary: "Strategic summary",
      gaps: "Profile gaps to close",
      tryUni: "Try the probability engine",
      empty: "No roadmap yet. Run the intake to generate one.",
      runIntake: "Run intake",
      regenerate: "Regenerate",
      categories: {
        Academics: "Academics",
        Testing: "Testing",
        Extracurriculars: "Extracurriculars",
        Skills: "Skills",
        Applications: "Applications",
      },
      priority: { high: "High priority", medium: "Medium", low: "Low" },
    },
    uni: {
      title: "Acceptance Probability Engine",
      subtitle: "ML-scored against historical admit patterns. Move the sliders to simulate.",
      probability: "Acceptance probability",
      whyTitle: "Why this score?",
      whyHint: "Top factors driving the model's prediction. Weights are transparent and updated live.",
      simTitle: "Scenario simulator",
      simHint: "Adjust your profile to see how each lever moves the probability.",
      gpa: "GPA (0–4.0)",
      test: "Standardized test percentile",
      ecCount: "Strong extracurriculars",
      research: "Research / publications",
      backToList: "All universities",
    },
    ethics: {
      title: "Ethical AI by design",
      body:
        "Every probability shows its top contributing factors and weights. The model uses transparent features - academics, testing, ECs, research signal - not demographic proxies. Bias review notes are published with each model update.",
    },
    footer: {
      tagline: "Polaris - your AI North Star.",
      built: "Powered by Gemma 4.",
    },
    lang: { en: "EN", bn: "বাংলা" },
  },
  bn: {
    nav: {
      product: "প্রোডাক্ট",
      pricing: "প্রাইসিং",
      howItWorks: "কীভাবে কাজ করে",
      tryIt: "এআই স্ট্র্যাটেজিস্ট চালান",
    },
    hero: {
      kicker: "এআই অ্যাকাডেমিক স্ট্র্যাটেজিস্ট",
      title1: "আপনার এআই",
      titleAccent: "নর্থ স্টার",
      title2: "-সেরা ভর্তির জন্য।",
      subtitle:
        "Polaris শীর্ষস্থানীয় বিশ্ববিদ্যালয়গুলো যেসব প্রোফাইল গ্রহণ করে, তা রিভার্স-ইঞ্জিনিয়ার করে। স্কুল থেকে গ্র্যাজুয়েট স্কুল-একটি ব্যক্তিগত, ডেটা-চালিত রোডম্যাপ।",
      ctaPrimary: "রোডম্যাপ শুরু করুন",
      ctaSecondary: "কীভাবে কাজ করে দেখুন",
      stat1: "২০+",
      stat1Label: "বেঞ্চমার্ক করা বিশ্ববিদ্যালয়",
      stat2: "৬–১৮ মাস",
      stat2Label: "কার্যকর রোডম্যাপ",
      stat3: "বাংলাদেশ + বিশ্ব",
      stat3Label: "প্রথম-শ্রেণির লোকালাইজেশন",
    },
    problem: {
      eyebrow: "সমস্যা",
      title: "মেধাবী শিক্ষার্থীরা অন্ধকারে আবেদন করে।",
      body:
        "বাংলাদেশের ৮৫% শিক্ষার্থী-এবং বিশ্বজুড়ে লক্ষ লক্ষ-খণ্ডিত রেডিট থ্রেড, ব্যয়বহুল কনসালট্যান্ট (২০০০+ ডলার) এবং অনুমানের ভিত্তিতে ভর্তির পথ চলে। শীর্ষস্থানীয় ভর্তিতে কৌশল কাজ করে, ভাগ্য নয়। Polaris সেই কৌশলকে সবার নাগালে আনে।",
      p1Title: "ছড়ানো-ছিটানো তথ্য",
      p1: "ফোরাম থ্রেড, পুরোনো ব্লগ, পরস্পরবিরোধী পরামর্শ।",
      p2Title: "নাগালের বাইরে কাউন্সেলিং",
      p2: "এলিট কনসালট্যান্টদের ফি এক বছরের টিউশনের চেয়েও বেশি।",
      p3Title: "পরিমাপযোগ্য ফিডব্যাক নেই",
      p3: "ভর্তি হওয়া আবেদনকারীর তুলনায় শিক্ষার্থী নিজের অবস্থান কখনোই দেখে না।",
    },
    how: {
      eyebrow: "কীভাবে কাজ করে",
      title: "প্রোফাইল থেকে অ্যাকসেপ্ট্যান্স পর্যন্ত, এক জায়গায়।",
      step1Title: "১ · ইনটেক",
      step1: "ছয়টি স্মার্ট প্রশ্নে আপনার গ্রেড, দেশ, লক্ষ্য, জিপিএ, কার্যক্রম এবং লক্ষ্য টিয়ার ক্যাপচার করা হয়।",
      step2Title: "২ · এআই স্ট্র্যাটেজিস্ট",
      step2: "Gemma 4 আপনার জন্য কোয়ার্টার-ভিত্তিক, স্ট্রাকচার্ড রোডম্যাপ তৈরি করে-RAG-ভিত্তিক বিশ্ববিদ্যালয় ডেটার উপর গ্রাউন্ডেড।",
      step3Title: "৩ · প্রবেবিলিটি ইঞ্জিন",
      step3: "একটি প্রশিক্ষিত ML মডেল ঐতিহাসিক ভর্তি ডেটার বিপরীতে আপনার সম্ভাবনা স্কোর করে-স্বচ্ছ ফ্যাক্টর সহ।",
      step4Title: "৪ · সিনারিও সিম",
      step4: "একটি স্লাইডার সরান, সম্ভাবনা কীভাবে বদলায় দেখুন। সময় খরচের আগে পরবর্তী ৬–১৮ মাস অপ্টিমাইজ করুন।",
    },
    pricing: {
      eyebrow: "প্রাইসিং",
      title: "প্রতিটি স্তরে কৌশল।",
      ctaFree: "ফ্রি শুরু করুন",
      ctaPro: "Pro নিন",
      ctaElite: "Elite নিন",
    },
    onboard: {
      title: "আমার রোডম্যাপ বানান",
      subtitle: "ছয়টি দ্রুত প্রশ্ন। বাকিটা আপনার এআই স্ট্র্যাটেজিস্ট সামলাবে।",
      q1: "আপনার বর্তমান গ্রেড কী?",
      q1opts: ["মিডল স্কুল (৬–৮)", "প্রাথমিক হাই স্কুল (৯–১০)", "শেষ হাই স্কুল (১১–১২)", "আন্ডারগ্র্যাড", "সদ্য গ্র্যাজুয়েট"],
      q2: "আপনি কোথায় আছেন?",
      q2opts: ["বাংলাদেশ", "ভারত", "পাকিস্তান", "নেপাল", "অন্যান্য দক্ষিণ এশিয়া", "অন্য"],
      q3: "লক্ষ্য ডিগ্রি?",
      q3opts: ["আন্ডারগ্র্যাজুয়েট (ব্যাচেলরস)", "মাস্টার্স", "পিএইচডি", "এখনও সিদ্ধান্তহীন"],
      q4: "বর্তমান একাডেমিক অবস্থান (জিপিএ বা সমতুল্য)",
      q4hint: "০–৪.০ স্কেল ব্যবহার করুন। আনুমানিক হলেও চলবে।",
      q5: "আপনার বর্তমান কার্যক্রম কোন ক্যাটাগরিতে পড়ে? (সব প্রযোজ্য বেছে নিন)",
      q5opts: ["অলিম্পিয়াড / প্রতিযোগিতা", "গবেষণা / প্রজেক্ট", "নেতৃত্ব / ক্লাব", "কমিউনিটি / স্বেচ্ছাসেবক", "খেলা / শিল্প", "ইন্টার্নশিপ / কাজ"],
      q6: "লক্ষ্য বিশ্ববিদ্যালয় টিয়ার?",
      q6opts: ["শীর্ষ গ্লোবাল (Ivy / Oxbridge / MIT-tier)", "শীর্ষ ৫০ গ্লোবাল", "শক্তিশালী আন্তর্জাতিক (শীর্ষ ২০০)", "আঞ্চলিক শক্তিশালী প্রোগ্রাম"],
      submit: "আমার রোডম্যাপ জেনারেট করুন",
      working: "Polaris আপনার কৌশল রিভার্স-ইঞ্জিনিয়ার করছে…",
    },
    dashboard: {
      title: "আপনার Polaris রোডম্যাপ",
      subtitle: "আপনার প্রোফাইল ও অনুরূপ শিক্ষার্থীদের ভর্তি প্যাটার্ন থেকে রিভার্স-ইঞ্জিনিয়ার করা।",
      next30: "পরবর্তী ৩০ দিন",
      summary: "স্ট্র্যাটেজিক সারসংক্ষেপ",
      gaps: "প্রোফাইলের যেসব ফাঁক পূরণ করতে হবে",
      tryUni: "প্রবেবিলিটি ইঞ্জিন চেষ্টা করুন",
      empty: "এখনও কোনো রোডম্যাপ নেই। ইনটেক চালান।",
      runIntake: "ইনটেক চালান",
      regenerate: "আবার জেনারেট করুন",
      categories: {
        Academics: "একাডেমিক",
        Testing: "টেস্টিং",
        Extracurriculars: "এক্সট্রাকারিকুলার",
        Skills: "স্কিল",
        Applications: "অ্যাপ্লিকেশন",
      },
      priority: { high: "উচ্চ অগ্রাধিকার", medium: "মাঝারি", low: "নিম্ন" },
    },
    uni: {
      title: "অ্যাকসেপ্ট্যান্স প্রবেবিলিটি ইঞ্জিন",
      subtitle: "ঐতিহাসিক ভর্তি প্যাটার্নের বিপরীতে ML-স্কোরড। সিমুলেট করতে স্লাইডার সরান।",
      probability: "অ্যাকসেপ্ট্যান্স প্রবেবিলিটি",
      whyTitle: "কেন এই স্কোর?",
      whyHint: "মডেলের পূর্বাভাস চালিত শীর্ষ ফ্যাক্টর। ওজন স্বচ্ছ এবং লাইভ আপডেট হয়।",
      simTitle: "সিনারিও সিমুলেটর",
      simHint: "প্রতিটি লিভার সম্ভাবনাকে কীভাবে সরায় দেখতে আপনার প্রোফাইল অ্যাডজাস্ট করুন।",
      gpa: "জিপিএ (০–৪.০)",
      test: "স্ট্যান্ডার্ডাইজড টেস্ট পার্সেন্টাইল",
      ecCount: "শক্তিশালী এক্সট্রাকারিকুলার",
      research: "গবেষণা / প্রকাশনা",
      backToList: "সব বিশ্ববিদ্যালয়",
    },
    ethics: {
      title: "ডিজাইনে নৈতিক এআই",
      body:
        "প্রতিটি সম্ভাবনা তার শীর্ষ ফ্যাক্টর ও ওজন দেখায়। মডেলটি স্বচ্ছ ফিচার ব্যবহার করে-একাডেমিক, টেস্টিং, ইসি, গবেষণা-কোনো ডেমোগ্রাফিক প্রক্সি নয়। প্রতিটি মডেল আপডেটের সাথে বায়াস রিভিউ নোট প্রকাশ করা হয়।",
    },
    footer: {
      tagline: "Polaris - আপনার এআই নর্থ স্টার।",
      built: "Gemma 4 দ্বারা চালিত।",
    },
    lang: { en: "EN", bn: "বাংলা" },
  },
};

export type Dict = AnyDict;
