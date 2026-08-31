import type { StudentProfile } from "./profile";
import type { RoadmapResponse, RoadmapMilestone } from "./llm/gemma";
import type { Lang } from "./i18n/strings";

/**
 * Deterministic roadmap built from heuristics + curated KB.
 * Used as a fallback if no Gemma 4 key is configured, so the demo flow
 * still works end-to-end without an API call.
 */
export function buildFallbackRoadmap(
  profile: StudentProfile,
  retrievedTitles: string[],
  language: Lang = "en",
): RoadmapResponse {
  const eliteUni = retrievedTitles[0] || "MIT";
  const isEarly = profile.grade === "middle" || profile.grade === "early-hs";
  const isLate = profile.grade === "late-hs" || profile.grade === "recent-grad";
  const wantsTop = profile.targetTier === "elite" || profile.targetTier === "top50";

  if (language === "bn") {
    return buildBengaliFallbackRoadmap(profile, eliteUni, isEarly, isLate, wantsTop);
  }

  const milestones: RoadmapMilestone[] = [
    {
      quarter: "Months 1–3",
      category: "Academics",
      title: profile.gpa < 3.85 ? "Push GPA toward 3.9+" : "Lock in academic ceiling",
      description:
        profile.gpa < 3.85
          ? "Identify the two subjects dragging GPA down and build weekly office-hour + tutor + practice-test routines."
          : "Maintain top-decile performance and start enriching with AP / A-level depth.",
      priority: profile.gpa < 3.85 ? "high" : "medium",
      rationale: `${eliteUni} and similar tier-1 universities expect a 3.9+ unweighted GPA from international applicants.`,
      metric: "Term GPA ≥ 3.9 / 4.0",
    },
    {
      quarter: "Months 1–3",
      category: "Testing",
      title: wantsTop ? "Diagnostic SAT + IELTS" : "Pick the right testing path",
      description:
        "Sit a full diagnostic SAT and a mock IELTS. Use scores to choose between SAT-heavy or A-level-heavy strategy.",
      priority: "high",
      rationale: "Tier-1 admissions decisions still weight standardized testing heavily for international applicants.",
      metric: "Diagnostic baseline recorded",
    },
    {
      quarter: "Months 3–6",
      category: "Extracurriculars",
      title: profile.ecs.includes("Research") ? "Convert research into a publishable result" : "Start a research project",
      description: profile.ecs.includes("Research")
        ? "Aim for a workshop submission or preprint by month 9. Find a co-author through a local university or online program."
        : "Reach out to a BUET / DU / local university faculty member for a 6-month independent project.",
      priority: "high",
      rationale: "Case studies of admits to tier-1 universities consistently show original research or publication signals.",
      metric: "1 workshop / preprint / poster submission",
    },
    {
      quarter: "Months 3–6",
      category: "Skills",
      title: "Ship a real-world product or tool",
      description:
        "Build something used by 100+ real people. Open-source it, document it, and link from your portfolio.",
      priority: "medium",
      rationale: "Founder-mindset and shipping signal differentiates well-rounded applicants in elite admissions.",
      metric: "Tool with 100+ active users",
    },
    {
      quarter: "Months 6–9",
      category: "Extracurriculars",
      title: "Compete at the highest reachable tier",
      description:
        "Target one Olympiad / hackathon / debate event at the highest tier you can realistically reach. Train weekly.",
      priority: "high",
      rationale: "Successful case studies show Olympiad medals or top contest finishes as a primary differentiator.",
      metric: "1 national-level placement",
    },
    {
      quarter: "Months 6–9",
      category: "Testing",
      title: "Sit official SAT / IELTS / subject test",
      description:
        "Take the real exam after consistent prep. Reserve a retake slot 6–8 weeks later.",
      priority: "high",
      rationale: "Two attempts maximize your superscore and protect against bad-day variance.",
      metric: wantsTop ? "SAT 1500+ / IELTS 7.5+" : "SAT 1400+ / IELTS 7+",
    },
    {
      quarter: "Months 9–12",
      category: "Applications",
      title: "Lock in 6–8 target universities",
      description:
        "Mix 2 reach, 3 target, 2 safety. Use the Polaris probability engine to calibrate.",
      priority: "medium",
      rationale: "A balanced list maximizes expected acceptance value, not just probability.",
      metric: "Finalized university list with rationale per school",
    },
    {
      quarter: "Months 9–12",
      category: "Applications",
      title: "First-draft personal essays",
      description:
        "Draft 1 Common-App-style essay + 2 supplements. Get feedback from 2 reviewers.",
      priority: "medium",
      rationale: "Essays are the highest-leverage application component because they cannot be retroactively improved.",
      metric: "3 essays at v2 draft",
    },
    {
      quarter: "Months 12–18",
      category: isLate ? "Applications" : "Skills",
      title: isLate ? "Submit applications + scholarships" : "Deepen one technical specialty",
      description: isLate
        ? "Apply EA/ED to top choice. Apply to 2 full-funding scholarships in parallel (e.g. Yale need-blind, NUS ASEAN)."
        : "Pick one technical area (ML, systems, biology, etc.) and reach undergraduate-textbook depth.",
      priority: "high",
      rationale: isLate
        ? "EA / ED rounds typically have 2–3x acceptance rates."
        : "Depth in one area beats breadth across many for elite admissions.",
      metric: isLate ? "Applications submitted" : "1 textbook completed + project shipped",
    },
  ];

  if (isEarly) {
    milestones.unshift({
      quarter: "Months 1–3",
      category: "Skills",
      title: "Build a learning system, not just grades",
      description:
        "Establish daily reading + weekly project habit. Pick one technical or creative interest to go deep on for the next 3 years.",
      priority: "high",
      rationale: "Middle and early-high-school students who build sustained habits compound over 4–6 years before applications.",
      metric: "Daily 60-min focused work logged for 8+ weeks",
    });
  }

  const gaps: string[] = [];
  if (profile.gpa < 3.9) gaps.push("Academic ceiling: successful admits typically had 3.9+ unweighted.");
  if (!profile.ecs.includes("Research")) gaps.push("No research signal - case studies show original work as a frequent differentiator.");
  if (!profile.ecs.includes("Olympiads")) gaps.push("No Olympiad / national competition - high-leverage differentiator for STEM.");
  if (!profile.ecs.includes("Leadership")) gaps.push("Limited leadership signal - scholarships like Rhodes / Chevening weight this heavily.");
  if (profile.ecs.length < 2) gaps.push("Narrow extracurricular footprint - aim for depth in 2 categories, not breadth across all six.");

  return {
    summary: `Over the next 6–18 months, focus on translating your current ${
      profile.targetTier === "elite" ? "strong" : "solid"
    } baseline into a competitive ${
      profile.targetTier === "elite" ? "tier-1 global" : "internationally strong"
    } application profile. The highest-leverage moves: standardized-test discipline, one deep ${
      profile.ecs.includes("Research") ? "research output" : "research or shipped-product project"
    }, and one national-level competition or distinction.`,
    gaps: gaps.slice(0, 5),
    milestones,
  };
}

function buildBengaliFallbackRoadmap(
  profile: StudentProfile,
  eliteUni: string,
  isEarly: boolean,
  isLate: boolean,
  wantsTop: boolean,
): RoadmapResponse {
  const milestones: RoadmapMilestone[] = [
    {
      quarter: "১–৩ মাস",
      category: "Academics",
      title: profile.gpa < 3.85 ? "GPA ৩.৯+ লক্ষ্যে উন্নীত করুন" : "একাডেমিক সর্বোচ্চ মান ধরে রাখুন",
      description: profile.gpa < 3.85
        ? "যে দুটি বিষয়ে GPA কমছে সেগুলো চিহ্নিত করে সাপ্তাহিক শিক্ষক-সহায়তা, টিউটরিং ও অনুশীলনী পরীক্ষার রুটিন তৈরি করুন।"
        : "শীর্ষ দশ শতাংশের ফল ধরে রাখুন এবং AP বা A-level মানের গভীর পড়াশোনা শুরু করুন।",
      priority: profile.gpa < 3.85 ? "high" : "medium",
      rationale: `${eliteUni} ও সমমানের বিশ্ববিদ্যালয় আন্তর্জাতিক আবেদনকারীদের কাছ থেকে সাধারণত খুব শক্তিশালী একাডেমিক ফল প্রত্যাশা করে।`,
      metric: "টার্ম GPA ≥ ৩.৯ / ৪.০",
    },
    {
      quarter: "১–৩ মাস",
      category: "Testing",
      title: wantsTop ? "SAT ও IELTS ডায়াগনস্টিক দিন" : "সঠিক পরীক্ষার পথ বেছে নিন",
      description: "একটি পূর্ণাঙ্গ SAT ডায়াগনস্টিক ও মক IELTS দিন। ফল দেখে SAT-কেন্দ্রিক বা A-level-কেন্দ্রিক কৌশল বেছে নিন।",
      priority: "high",
      rationale: "আন্তর্জাতিক আবেদনকারীদের ক্ষেত্রে মানসম্মত পরীক্ষার ফল এখনো শক্তিশালী একাডেমিক প্রমাণ।",
      metric: "প্রাথমিক ডায়াগনস্টিক স্কোর নথিভুক্ত",
    },
    {
      quarter: "৩–৬ মাস",
      category: "Extracurriculars",
      title: profile.ecs.includes("Research") ? "গবেষণাকে প্রকাশযোগ্য ফলাফলে রূপ দিন" : "একটি গবেষণা প্রকল্প শুরু করুন",
      description: profile.ecs.includes("Research")
        ? "৯ মাসের মধ্যে ওয়ার্কশপ জমা, প্রিপ্রিন্ট বা পোস্টার তৈরির লক্ষ্য নিন এবং স্থানীয় বিশ্ববিদ্যালয় বা অনলাইন প্রোগ্রাম থেকে সহলেখক খুঁজুন।"
        : "ছয় মাসের স্বাধীন প্রকল্পের জন্য BUET, DU বা স্থানীয় বিশ্ববিদ্যালয়ের একজন শিক্ষকের সঙ্গে যোগাযোগ করুন।",
      priority: "high",
      rationale: "শীর্ষ বিশ্ববিদ্যালয়ে ভর্তি হওয়া শিক্ষার্থীদের উদাহরণে মৌলিক গবেষণা বা প্রকাশনার প্রমাণ নিয়মিত দেখা যায়।",
      metric: "১টি ওয়ার্কশপ, প্রিপ্রিন্ট বা পোস্টার জমা",
    },
    {
      quarter: "৩–৬ মাস",
      category: "Skills",
      title: "বাস্তব ব্যবহারযোগ্য পণ্য বা টুল প্রকাশ করুন",
      description: "কমপক্ষে ১০০ জন বাস্তব ব্যবহারকারীর কাজে লাগে এমন কিছু তৈরি করুন। ওপেন সোর্স করুন, ভালো ডকুমেন্টেশন লিখুন এবং পোর্টফোলিওতে যুক্ত করুন।",
      priority: "medium",
      rationale: "সমস্যা সমাধান করে বাস্তব কিছু প্রকাশ করার প্রমাণ আবেদনকে আলাদা করে।",
      metric: "১০০+ সক্রিয় ব্যবহারকারীসহ একটি টুল",
    },
    {
      quarter: "৬–৯ মাস",
      category: "Extracurriculars",
      title: "সর্বোচ্চ অর্জনযোগ্য পর্যায়ে প্রতিযোগিতা করুন",
      description: "বাস্তবসম্মতভাবে পৌঁছানো যায় এমন সর্বোচ্চ স্তরের একটি অলিম্পিয়াড, হ্যাকাথন বা বিতর্ক প্রতিযোগিতা বেছে নিয়ে সাপ্তাহিক অনুশীলন করুন।",
      priority: "high",
      rationale: "জাতীয় বা আন্তর্জাতিক পর্যায়ের সাফল্য একটি শক্তিশালী পার্থক্যকারী প্রমাণ।",
      metric: "১টি জাতীয় পর্যায়ের অবস্থান",
    },
    {
      quarter: "৬–৯ মাস",
      category: "Testing",
      title: "অফিশিয়াল SAT, IELTS বা বিষয়ভিত্তিক পরীক্ষা দিন",
      description: "ধারাবাহিক প্রস্তুতির পর আসল পরীক্ষা দিন এবং ৬–৮ সপ্তাহ পরে পুনরায় পরীক্ষার একটি সুযোগ সংরক্ষণ করুন।",
      priority: "high",
      rationale: "দুটি সুযোগ খারাপ দিনের ঝুঁকি কমায় এবং সর্বোচ্চ স্কোর পাওয়ার সম্ভাবনা বাড়ায়।",
      metric: wantsTop ? "SAT ১৫০০+ / IELTS ৭.৫+" : "SAT ১৪০০+ / IELTS ৭+",
    },
    {
      quarter: "৯–১২ মাস",
      category: "Applications",
      title: "৬–৮টি লক্ষ্য বিশ্ববিদ্যালয় চূড়ান্ত করুন",
      description: "২টি উচ্চাকাঙ্ক্ষী, ৩টি লক্ষ্য এবং ২টি নিরাপদ বিকল্প রাখুন। Polaris-এর সম্ভাব্যতা বিশ্লেষণ দিয়ে তালিকাটি ভারসাম্য করুন।",
      priority: "medium",
      rationale: "ভারসাম্যপূর্ণ তালিকা শুধু সম্ভাবনা নয়, গ্রহণযোগ্য ফলাফলের সামগ্রিক সুযোগ বাড়ায়।",
      metric: "প্রতিটি বিশ্ববিদ্যালয়ের যুক্তিসহ চূড়ান্ত তালিকা",
    },
    {
      quarter: "৯–১২ মাস",
      category: "Applications",
      title: "ব্যক্তিগত প্রবন্ধের প্রথম খসড়া লিখুন",
      description: "Common App ধরনের ১টি মূল প্রবন্ধ ও ২টি সম্পূরক প্রবন্ধ লিখে দুজন পর্যালোচকের মতামত নিন।",
      priority: "medium",
      rationale: "প্রবন্ধ আবেদনকারীর নিজস্ব কণ্ঠ ও প্রেক্ষাপট দেখানোর সবচেয়ে গুরুত্বপূর্ণ সুযোগগুলোর একটি।",
      metric: "দ্বিতীয় সংস্করণে ৩টি প্রবন্ধ",
    },
    {
      quarter: "১২–১৮ মাস",
      category: isLate ? "Applications" : "Skills",
      title: isLate ? "আবেদন ও স্কলারশিপ জমা দিন" : "একটি কারিগরি বিষয়ে গভীর দক্ষতা গড়ুন",
      description: isLate
        ? "শীর্ষ পছন্দে EA বা ED আবেদন করুন এবং পাশাপাশি পূর্ণ অর্থায়নের অন্তত দুটি স্কলারশিপে আবেদন করুন।"
        : "ML, সিস্টেম, জীববিজ্ঞান বা পছন্দের একটি বিষয়ে স্নাতক-স্তরের পাঠ্যবইয়ের গভীরতা অর্জন করুন।",
      priority: "high",
      rationale: isLate
        ? "আগে প্রস্তুত আবেদন সময়সীমা, অর্থায়ন ও নথিপত্রের ঝুঁকি কমায়।"
        : "অনেক বিষয়ে অগভীরতার চেয়ে একটি বিষয়ে প্রমাণযোগ্য গভীরতা বেশি মূল্যবান।",
      metric: isLate ? "আবেদন জমা সম্পন্ন" : "১টি পাঠ্যবই শেষ এবং ১টি প্রকল্প প্রকাশ",
    },
  ];

  if (isEarly) {
    milestones.unshift({
      quarter: "১–৩ মাস",
      category: "Skills",
      title: "শুধু ফল নয়, শেখার একটি ব্যবস্থা গড়ুন",
      description: "দৈনিক পড়া ও সাপ্তাহিক প্রকল্পের অভ্যাস তৈরি করুন। একটি কারিগরি বা সৃজনশীল আগ্রহ বেছে নিয়ে আগামী তিন বছর গভীরভাবে কাজ করুন।",
      priority: "high",
      rationale: "মধ্য বা প্রারম্ভিক উচ্চবিদ্যালয় পর্যায়ে স্থায়ী অভ্যাস গড়লে আবেদনের আগে বহু বছর ধরে তার সুফল জমা হয়।",
      metric: "৮+ সপ্তাহ প্রতিদিন ৬০ মিনিট মনোযোগী কাজের রেকর্ড",
    });
  }

  const gaps: string[] = [];
  if (profile.gpa < 3.9) gaps.push("একাডেমিক ঘাটতি: সফল আবেদনকারীদের ফল সাধারণত আরও শক্তিশালী।");
  if (!profile.ecs.includes("Research")) gaps.push("গবেষণার প্রমাণ নেই-মৌলিক কাজ আবেদনকে আলাদা করতে পারে।");
  if (!profile.ecs.includes("Olympiads")) gaps.push("অলিম্পিয়াড বা জাতীয় প্রতিযোগিতার প্রমাণ নেই-STEM প্রোফাইলে এটি গুরুত্বপূর্ণ হতে পারে।");
  if (!profile.ecs.includes("Leadership")) gaps.push("নেতৃত্বের প্রমাণ সীমিত-বহু স্কলারশিপে বাস্তব নেতৃত্বকে গুরুত্ব দেওয়া হয়।");
  if (profile.ecs.length < 2) gaps.push("সহশিক্ষা কার্যক্রম সীমিত-অনেক বিষয়ে ছড়িয়ে না গিয়ে দুটি ক্ষেত্রে গভীরতা গড়ুন।");

  return {
    summary: `আগামী ৬–১৮ মাসে আপনার বর্তমান ভিত্তিকে একটি প্রতিযোগিতামূলক আন্তর্জাতিক আবেদন প্রোফাইলে রূপ দিন। সর্বোচ্চ প্রভাবের কাজ হলো নিয়মিত পরীক্ষার প্রস্তুতি, একটি গভীর ${profile.ecs.includes("Research") ? "গবেষণা ফলাফল" : "গবেষণা বা প্রকাশিত পণ্য প্রকল্প"} এবং জাতীয় পর্যায়ের একটি প্রতিযোগিতা বা স্বীকৃতি।`,
    gaps: gaps.slice(0, 5),
    milestones,
  };
}

