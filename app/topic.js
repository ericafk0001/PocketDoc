const TOPIC_CONTENT = {
  "wound-care-basics": {
    header: "Basics",
    iconClass: "bi bi-droplet-half",
    title: "Wound Care Basics",
    summary:
      "Most minor wounds heal well when cleaned gently, kept moist, and protected from friction and dirt.",
    checklist: [
      "Wash your hands before touching the wound.",
      "Rinse the wound with clean running water for several minutes.",
      "Pat dry surrounding skin and apply a thin layer of petroleum jelly or prescribed ointment.",
      "Cover with a clean, non-stick dressing and change daily or when wet.",
      "Monitor for pain, swelling, discharge, or worsening redness.",
    ],
    urgent: [
      "Bleeding does not stop after 10 minutes of direct pressure.",
      "A deep wound exposes fat, muscle, or bone.",
      "You cannot remove debris from the wound.",
    ],
  },
  "infection-red-flags": {
    header: "Warning Signs",
    iconClass: "bi bi-exclamation-triangle",
    title: "Infection Red Flags",
    summary:
      "Early recognition of infection can prevent complications. Watch for changes that get worse over time.",
    checklist: [
      "Check daily for spreading redness around the wound edge.",
      "Notice warmth, increasing tenderness, or swelling.",
      "Look for cloudy fluid, pus, or foul odor.",
      "Track body symptoms such as fever, chills, or fatigue.",
      "Take photos once daily to compare progression objectively.",
    ],
    urgent: [
      "Red streaks travel away from the wound.",
      "Fever appears with worsening local symptoms.",
      "Pain becomes severe or rapidly intensifies.",
    ],
  },
  "first-aid-checklist": {
    header: "Quick Actions",
    iconClass: "bi bi-bandaid",
    title: "First Aid Checklist",
    summary:
      "Use a simple first-aid flow to reduce infection risk and protect healing tissue.",
    checklist: [
      "Stop bleeding with direct pressure using clean gauze or cloth.",
      "Rinse with clean water and remove visible dirt gently.",
      "Apply antiseptic only if advised for your wound type.",
      "Dress with sterile, breathable material.",
      "Review tetanus vaccine status if wound is dirty or puncture-like.",
    ],
    urgent: [
      "Bleeding soaks through multiple dressings quickly.",
      "Injury follows an animal or human bite.",
      "Wound is caused by a rusty or contaminated object and vaccination is outdated.",
    ],
  },
  "when-to-see-a-doctor": {
    header: "Escalation",
    iconClass: "bi bi-hospital",
    title: "When to See a Doctor",
    summary:
      "Some wounds need in-person assessment for stitches, antibiotics, or advanced care.",
    checklist: [
      "Seek care for wounds larger than 1 to 2 cm or with separated edges.",
      "Get evaluated if healing stalls after several days.",
      "See a clinician sooner if you have diabetes or poor circulation.",
      "Ask for care if pain limits normal movement.",
      "Schedule follow-up for repeated breakdown in the same area.",
    ],
    urgent: [
      "You have trouble breathing, chest pain, or feel faint.",
      "There is uncontrolled bleeding or signs of shock.",
      "High fever develops with confusion or severe weakness.",
    ],
  },
};

function createListItem(text, colorClass) {
  return `<li class="rounded-xl ${colorClass} px-3 py-2.5 text-sm">${text}</li>`;
}

function renderTopic() {
  const params = new URLSearchParams(window.location.search);
  const topicKey = params.get("topic") || "wound-care-basics";
  const topic = TOPIC_CONTENT[topicKey] || TOPIC_CONTENT["wound-care-basics"];

  const topicHeader = document.getElementById("topicHeader");
  const topicIcon = document.getElementById("topicIcon");
  const topicTitle = document.getElementById("topicTitle");
  const topicSummary = document.getElementById("topicSummary");
  const topicChecklist = document.getElementById("topicChecklist");
  const topicUrgent = document.getElementById("topicUrgent");
  const askAiLink = document.getElementById("askAiLink");

  topicHeader.textContent = topic.header;
  topicIcon.innerHTML = `<i class="${topic.iconClass}"></i>`;
  topicTitle.textContent = topic.title;
  topicSummary.textContent = topic.summary;
  topicChecklist.innerHTML = topic.checklist
    .map((item) => createListItem(item, "bg-[#f5f8ff] text-[#1f3f78]"))
    .join("");
  topicUrgent.innerHTML = topic.urgent
    .map((item) =>
      createListItem(item, "bg-white text-[#b04a4a] border border-[#ffd8d8]"),
    )
    .join("");

  const aiPrompt = `Give me practical guidance for ${topic.title.toLowerCase()} and what warning signs I should watch for.`;
  askAiLink.href = `ai.html?message=${encodeURIComponent(aiPrompt)}`;
}

renderTopic();
