const copy = {
  en: {
    skip: "Skip to content",
    navAbout: "About",
    navService: "Service",
    navContact: "Contact",
    hero1: "Every day,",
    hero2: "on your side.",
    heroDescription:
      "For the quiet days. And the not-so-quiet ones.<br>Cande makes thoughtful little services<br>to help your day feel a little lighter.",
    discover: "Meet our service",
    artNote: "How was your day?",
    artBubble1: "I’m on your side.",
    artBubble2: "Let it all out here!",
    heroFoot: "A little understanding. A different kind of day.",
    aboutNote: "What we make",
    aboutTitle:
      'Not a grand change.<br>Something <span class="underlined">you can feel.</span>',
    aboutText1:
      "That moment someone really listens.<br>That little reply that makes you smile.",
    aboutText2:
      "We believe in the power of small moments.<br>With a little technology and a warm response,<br>we make services that feel close to your everyday life.",
    value1: "Start with how people feel",
    value2: "Leave out the complicated parts",
    value3: "Make room for a little joy",
    serviceNote: "Our first story",
    appName: "Jeongbyeong Balsa",
    appIcon: "Jeongbyeong Balsa app icon",
    serviceTitle: "The words you held back.<br>The friends ready to listen.",
    serviceDescription:
      "Not quite ready to send it to your group chat?<br>Let it out with your own AI friends first.<br>A reaction chat for days when you want empathy before answers.",
    feature1: "AI friends with different personalities",
    feature2: "One-on-one or a group of up to 3 AI friends",
    feature3: "Nicknames and profiles you make your own",
    appContact: "Ask us about the app",
    chatNote: "A little company goes a long way.",
    chatLabel: "Illustrative Jeongbyeong Balsa conversation",
    roomName: "Always on my side",
    demoLabel: "Illustrative conversation",
    userMessage: "I did the whole group project alone…<br>How is that fair?",
    friend1: "Warm · Secure",
    friend2: "Caring · Anxious",
    friend3: "Chill · Avoidant",
    reply1:
      "All by yourself? That sounds exhausting.<br>You can let it all out here.",
    reply2: "I’d be upset too…<br>You shouldn’t have had to carry it alone.",
    reply3: "Take a break for today.<br>I’m here to listen.",
    demoBottom: "A little space to let it all out.",
    stageCaption: "Three personalities. Their own ways of showing they care.",
    statement:
      'A little closer.<br>A little <span class="hand">lighter.</span>',
    statementSmall: "The kind of everyday life we want to help create.",
    contactNote: "We’d love to hear from you",
    contactTitle: 'Let’s talk<span class="hand">.</span>',
    contactDescription:
      "A question about our service, or an idea to build together?<br>Drop us a line. We’re listening.",
    emailLabel: "Send Cande an email",
    footerSlogan: "Every day, on your side.",
    backTop: "Back to top",
    businessName: "Business name: 칸데(CANDE)",
    registration: "Business registration no.: 798-35-01563",
    taxType: "General VAT taxpayer",
    inquiry: "Contact",
  },
};
const translated = [...document.querySelectorAll("[data-i18n]")];
copy.ko = Object.fromEntries(
  translated.map((el) => [el.dataset.i18n, el.innerHTML]),
);
copy.ko.appIcon = "정병발사 앱 아이콘";
copy.ko.chatLabel = "정병발사 대화 예시";
copy.ko.emailLabel = "Cande에 이메일 보내기";
const descriptions = {
  ko: "Cande는 일상에 작은 내 편이 되는 서비스를 만듭니다. AI 친구들과 감정을 나누는 리액션 채팅 앱, 정병발사를 만나보세요.",
  en: "Cande makes thoughtful little services to help your day feel lighter. Meet Jeongbyeong Balsa, a reaction chat with your own AI friends.",
};
function setLanguage(language) {
  if (!copy[language]) language = "ko";
  document.documentElement.lang = language;
  translated.forEach((el) => {
    el.innerHTML = copy[language][el.dataset.i18n];
  });
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
  document.title =
    language === "ko"
      ? "Cande — 일상에, 작은 내 편."
      : "Cande — Every day, on your side.";
  document.querySelector('meta[name="description"]').content =
    descriptions[language];
  try {
    localStorage.setItem("cande-language", language);
  } catch {
    /* Preferences are optional. */
  }
}
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
document.querySelector("#year").textContent = new Date().getFullYear();
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
if ("IntersectionObserver" in window) {
  document.documentElement.classList.add("js-motion");
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.1 },
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}
let pending = false;
function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.documentElement.style.setProperty(
    "--scroll",
    max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0,
  );
  document.documentElement.style.setProperty(
    "--drift",
    motionPreference.matches ? "0px" : `${Math.min(scrollY * 0.07, 35)}px`,
  );
  pending = false;
}
addEventListener(
  "scroll",
  () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(updateScroll);
    }
  },
  { passive: true },
);
addEventListener("resize", updateScroll);
motionPreference.addEventListener("change", updateScroll);
updateScroll();
