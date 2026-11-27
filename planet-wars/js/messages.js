const INTRO_MESSAGES = {
  welcome: "Welcome! You're here to observe and watch planets grow from dust, then see which worlds survive. Press Play to start!",
  start: "Dust is circling the Sun. Let’s see what happens.",
  firstPlanets: "Look, planets are popping up all around the Sun. See them picking up dust?",
  planetColours: "Look at all those colours. Hard to believe those planets started out as dust.",
  dustClearing: "The leftover dust is starting to drift away.",
  rogues: "Here come the rogue planets. Let’s see what they bump into.",
  comets: "The comets are here! They can destroy a planet's protection until there's nothing left to save it.",
};

const LIVE_REPORTS = {
  dustMoonMerger: "Nice! Two planets collided, and the one that survived now has a moon.",
  absorbedRogue: "One of those rogues just got swallowed by a planet.",
  planetMerger: "Those two planets just became one.",
  moon: "Look, a new moon is circling that planet.",
  rings: "That planet’s got rings now.",
  sizeBoost: "That planet just got a little bigger.",
  life: "Life has begun on that planet. See it glowing?",
  lasers: "That planet’s got new tech. It can shoot at nearby threats now.",
  cometMerger: "Those comets just merged into one bigger, faster comet.",
  cometDamage: "That comet took out a layer of protection.",
  cometDestroyedPlanet: "That comet hit a planet and took it out.",
  interceptedComet: "That planet shot a comet before getting hit. Way to go!",
  planetShotDown: "One planet just took out another with a shot.",
  planetLaserExchange: "Those two planets are firing at each other. Who do you think will win?",
};

const SYSTEM_TIPS = [
  "Planets get bigger by picking up dust. Once the dust is gone, that’s their base size.",
  "Rogues are the dark grey planets. They’re just passing through unless something gets in their way.",
  "Moons come first. Once a planet has three, its next merger can give it rings.",
  "When two planets bump into each other, the one with more protection wins. If neither has any, the bigger one wins.",
  "After a planet gets its size boost, it has to survive 30 seconds before it starts to glow.",
  "Keep that glow going for another 30 seconds and the planet can start firing.",
  "Big comets can take out two layers of protection in one hit.",
  "Planets don’t aim at rogues, but a stray shot can still hit one.",
];

const MESSAGE_CHARACTER_MS = 30;
const MESSAGE_MIN_READ_SECONDS = 8;
const REPORT_REPEAT_SECONDS = 30;
const TIP_IDLE_SECONDS = 15;
const TIP_REPEAT_SECONDS = 90;

class SystemReporter {
  constructor(visual, announcement) {
    this.visual = visual;
    this.announcement = announcement;
  }

  reset() {
    this.elapsed = 0;
    this.started = false;
    this.intros = [];
    this.reports = [];
    this.seenIntros = new Set();
    this.lastReportAt = new Map();
    this.tips = [...SYSTEM_TIPS];
    this.tipsEnabled = false;
    this.lastTipAt = new Map();
    this.show("welcome", INTRO_MESSAGES.welcome);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.show("start", INTRO_MESSAGES.start);
  }

  hasSeenIntro(key) {
    return this.seenIntros.has(key);
  }

  intro(key) {
    if (this.hasSeenIntro(key)) return;
    this.seenIntros.add(key);
    this.intros.push({ key, text: INTRO_MESSAGES[key] });
  }

  canReport(key) {
    const last = this.lastReportAt.get(key) ?? -Infinity;
    return this.elapsed - last >= REPORT_REPEAT_SECONDS
      && !this.reports.some(report => report.key === key);
  }

  report(key) {
    if (!this.canReport(key)) return;
    // A repeated report is only useful while the event is still recent.
    const expiresAt = this.lastReportAt.has(key) ? this.elapsed + REPORT_REPEAT_SECONDS : Infinity;
    this.reports.push({ key, text: LIVE_REPORTS[key], expiresAt });
  }

  show(key, text) {
    clearTimeout(this.revealTimer);
    this.announcement.textContent = "";
    const active = { key, shownAt: this.elapsed, readUntil: Infinity };
    this.active = active;
    let revealed = 0;
    const reveal = () => {
      if (this.active !== active) return;
      this.visual.textContent = text.slice(0, ++revealed);
      if (revealed < text.length) {
        this.revealTimer = setTimeout(reveal, MESSAGE_CHARACTER_MS);
      } else {
        // Announce once, after typing. Reading time starts with the whole line on screen.
        this.announcement.textContent = text;
        if (key !== "welcome") {
          active.readUntil = this.elapsed + Math.max(MESSAGE_MIN_READ_SECONDS, text.split(/\s+/).length * 0.45);
        }
      }
    };
    reveal();
  }

  update(elapsed) {
    this.elapsed = elapsed;
    if (!this.active || elapsed < this.active.readUntil) return;
    if (this.active.key === "comets") this.tipsEnabled = true;
    // Leave the finished line up until there is something new to say.
    const intro = this.intros.shift();
    if (intro) {
      this.show(intro.key, intro.text);
      return;
    }
    while (this.reports[0]?.expiresAt <= elapsed) this.reports.shift();
    const report = this.reports.shift();
    if (report) {
      this.lastReportAt.set(report.key, elapsed);
      this.show(report.key, report.text);
    } else if (this.tipsEnabled && elapsed - this.active.shownAt >= TIP_IDLE_SECONDS) {
      if (this.tips.length === 0) this.tips = [...SYSTEM_TIPS];
      const available = this.tips.filter(tip => elapsed - (this.lastTipAt.get(tip) ?? -Infinity) >= TIP_REPEAT_SECONDS);
      if (available.length === 0) return;
      const tip = available[Math.floor(Math.random() * available.length)];
      this.tips.splice(this.tips.indexOf(tip), 1);
      this.lastTipAt.set(tip, elapsed);
      this.show("tip", tip);
    }
  }
}

const systemReporter = new SystemReporter(
  document.getElementById("system-message-text"),
  document.getElementById("system-message-announcement"),
);
