const copy = {
  en: {
    skip: "Skip to content",
    privacyLink: "Privacy Policy",
    termsLink: "Terms of Service",
    backHome: "Home",
    effectiveDate: "Effective October 1, 2026 · Prepared September 19, 2026",
    privacyReview:
      "Scheduled policy draft. Actual international processing locations and provider deletion/backup periods will be finalized against operational contracts before the effective date.",
    navService: "Service",
    companyIntro: "Cande makes <br>mobile apps.",
    companyDetail:
      "We’re currently building <br>Jeongbyeong Balsa, an AI chat app.",
    heroPrimary: "See Jeongbyeong Balsa",
    heroSecondary: "Contact us",
    appName: "Jeongbyeong Balsa",
    appIcon: "Jeongbyeong Balsa app icon",
    appCategory: "AI reaction chat",
    productTitle: "Before it goes<br>in the group chat",
    productDescription:
      "Something frustrating happened? Tell your AI friends first. Each responds to your story with their own personality and way of speaking.",
    storeApple: "Get it on the App Store",
    storeGoogle: "Get it on Google Play",
    storeComing: "Coming soon.",
    personasLabel: "AI friend personalities",
    persona1: "Secure",
    persona2: "Anxious",
    persona3: "Avoidant",
    persona1Description: "Calmly listens and offers steady reassurance.",
    persona2Description: "Quickly empathizes and worries alongside you.",
    persona3Description: "Keeps it brief and helps you step back.",
    chatLabel: "Illustrative Jeongbyeong Balsa conversation",
    roomName: "Always on my side",
    userMessage: "I did the whole group project alone…<br>How is that fair?",
    friend1: "Warm",
    friend2: "Caring",
    friend3: "Chill",
    reply1:
      "All by yourself? That sounds exhausting.<br>You can let it all out here.",
    reply2: "I’d be upset too…<br>You shouldn’t have had to carry it alone.",
    reply3: "Take a break for today.<br>I’m here to listen.",
    demoLabel: "An illustrative conversation from the service.",
    conversationLabel: "Conversations",
    conversationDetail: "Choose 1 to 3 AI friends for a one-on-one or group chat.",
    profileLabel: "Your friends",
    profileDetail: "Pick their nicknames, profile images and personalities.",
    businessName: "Business name: 칸데(CANDE)",
    registration: "Business registration no.: 798-35-01563",
    taxType: "General VAT taxpayer",
  },
};
const translated = [...document.querySelectorAll("[data-i18n]")];
copy.ko = Object.fromEntries(
  translated.map((el) => [el.dataset.i18n, el.innerHTML]),
);
copy.ko.appIcon = "정병발사 앱 아이콘";
copy.ko.chatLabel = "정병발사 대화 예시";
copy.ko.personasLabel = "AI 친구 성향";
copy.ko.persona1Description = "차분히 이야기를 듣고 안정감 있게 다독여요.";
copy.ko.persona2Description = "빠르게 공감하며 함께 걱정하고 반응해요.";
copy.ko.persona3Description = "담백하게 반응하며 한발 물러서 보게 해요.";
const descriptions = {
  ko: "Cande는 모바일 앱을 만듭니다. AI 친구들과 대화하는 리액션 채팅 앱, 정병발사를 소개합니다.",
  en: "Cande makes mobile apps. Meet Jeongbyeong Balsa, a reaction chat app with your own AI friends.",
};
function setLanguage(language) {
  if (language !== "ko" && language !== "en") language = "ko";
  activeLanguage = language;
  document.documentElement.lang = language;
  translated.forEach((el) => {
    el.innerHTML = copy[language][el.dataset.i18n];
  });
  const selectedPersona = document.querySelector(
    '.persona-option[aria-pressed="true"]',
  );
  const personaDescription = document.querySelector(".persona-description");
  if (personaDescription) {
    personaDescription.textContent = selectedPersona
      ? copy[language][selectedPersona.dataset.persona]
      : "";
  }
  document.querySelectorAll("[data-alt]").forEach((el) => {
    el.alt = copy[language][el.dataset.alt];
  });
  document.querySelectorAll("[data-label]").forEach((el) => {
    el.setAttribute("aria-label", copy[language][el.dataset.label]);
  });
  document
    .querySelectorAll("[data-lang]")
    .forEach((el) =>
      el.setAttribute("aria-pressed", String(el.dataset.lang === language)),
    );
  const page = document.body.dataset.page;
  document.querySelectorAll("[data-document-language]").forEach((article) => {
    article.hidden = article.dataset.documentLanguage !== language;
  });
  if (page === "privacy" || page === "terms") {
    const title = copy[language][page + "Link"];
    document.title = title + " | Cande";
    document.querySelector('meta[name="description"]').content =
      language === "ko"
        ? "Cande 정병발사 " + title + ". 시행일 2026년 10월 1일."
        : "Cande Jeongbyeong Balsa " + title + ". Effective October 1, 2026.";
    const anchor = location.hash.match(/^#(privacy|terms)-(ko|en)-(\d+)$/);
    if (anchor && anchor[2] !== language) {
      history.replaceState(
        null,
        "",
        "#" + anchor[1] + "-" + language + "-" + anchor[3],
      );
    }
  } else {
    document.title =
      language === "ko"
        ? "Cande | 모바일 앱을 만듭니다."
        : "Cande | We make mobile apps.";
    document.querySelector('meta[name="description"]').content =
      descriptions[language];
  }
  try {
    localStorage.setItem("cande-language", language);
  } catch {
    /* Preferences are optional. */
  }
}
let activeLanguage = "ko";
let initialLanguage = "ko";
try {
  initialLanguage = localStorage.getItem("cande-language") || "ko";
} catch {
  /* Korean is the default. */
}
setLanguage(initialLanguage);
document
  .querySelectorAll("[data-lang]")
  .forEach((button) =>
    button.addEventListener("click", () => setLanguage(button.dataset.lang)),
  );
document.querySelectorAll(".store-actions button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".store-status").hidden = false;
  });
});
document.querySelectorAll(".persona-option").forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.getAttribute("aria-pressed") === "true";
    document.querySelectorAll(".persona-option").forEach((option) =>
      option.setAttribute("aria-pressed", "false"),
    );
    const description = document.querySelector(".persona-description");
    if (selected) {
      description.textContent = "";
      return;
    }
    button.setAttribute("aria-pressed", "true");
    description.textContent = copy[activeLanguage][button.dataset.persona];
  });
});
document.querySelector("#year").textContent = new Date().getFullYear();
// Motion is tied to scroll progress and remains disabled by reduced-motion CSS.
document.documentElement.classList.add("js-motion");
requestAnimationFrame(() =>
  requestAnimationFrame(() =>
    document.documentElement.classList.add("page-ready"),
  ),
);
const chatStages = [...document.querySelectorAll(".chat-stage")];
let scrollTicking = false;
function updateScrollMotion() {
  scrollTicking = false;
  chatStages.forEach((stage) => {
    const rect = stage.getBoundingClientRect();
    const messageStart = window.innerHeight * 0.48;
    const travel = Math.max(window.innerHeight * 0.6, 420);
    const progress = (messageStart - rect.top) / travel;
    stage.querySelectorAll(".chat-row").forEach((row, index) => {
      row.classList.toggle("visible", progress >= index * 0.25);
    });
  });
}
function requestScrollMotionUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(updateScrollMotion);
}
window.addEventListener("scroll", requestScrollMotionUpdate, { passive: true });
window.addEventListener("resize", requestScrollMotionUpdate);
updateScrollMotion();
