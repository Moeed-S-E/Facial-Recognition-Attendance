import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AppMark } from "../components/ui/app-ui";
import { IconSymbol } from "../components/ui/icon-symbol";

gsap.registerPlugin(ScrollTrigger);

const palette = {
  ink: "#101828",
  muted: "#667085",
  blue: "#5AA9E6",
  blueDeep: "#173A59",
  ice: "#BCE1F9",
  gold: "#D7A61D",
};

const features = [
  { icon: "person.2.fill", eyebrow: "01 / Roles", title: "Access follows responsibility.", text: "HR provisions people, managers coordinate their teams, and employees see only the work they need." },
  { icon: "faceid", eyebrow: "02 / Attendance", title: "A calmer check-in.", text: "A consented face capture or PIN fallback records attendance without shared passwords or buddy punching." },
  { icon: "chart.bar.fill", eyebrow: "03 / Insight", title: "Signals stay reviewable.", text: "History, coverage, and patterns are visible to the people responsible for acting on them." },
];

const steps = [
  { number: "01", title: "Set the organization", text: "Create the workspace and give the owner a clear control plane." },
  { number: "02", title: "Provision the people", text: "HR creates accounts. Managers request existing employees for their teams." },
  { number: "03", title: "Run the day", text: "Employees capture attendance while the organization keeps context." },
];

const faqs = [
  { q: "Who creates employee accounts?", a: "HR and the organization owner can create accounts. Managers assign existing employees to their team but cannot create new users." },
  { q: "Are managers and HR also employees?", a: "Yes. They retain their management permissions and can enroll attendance for their own account." },
  { q: "Does the platform make employment decisions?", a: "No. Attendance and recognition signals are operational guidance. Organizations remain responsible for review, context, and employment decisions." },
  { q: "Where is the application data stored?", a: "The application uses the configured local database and storage services. The project does not require a hosted platform account." },
];

function ProductPreview() {
  return (
    <div className="landing-preview relative overflow-hidden rounded-[30px] border border-white/80 bg-white/90 p-3 shadow-[0_32px_90px_rgba(23,58,89,0.18)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-line/70 px-3 pb-3 text-[10px] font-bold text-muted">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#8FE0B9]" /> Sample workspace</span>
        <span className="rounded-full bg-vanilla-soft px-2 py-1 text-[#735C00]">Demo data</span>
      </div>
      <div className="grid gap-3 p-2 sm:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[24px] bg-blue-deep p-5 text-white">
          <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-white/70">Today</span><IconSymbol name="arrow.right" size={16} color="#BCE1F9" /></div>
          <p className="mt-10 text-[11px] text-white/60">Attendance coverage</p>
          <p className="mt-1 text-[48px] font-extrabold tracking-[-0.08em]">94<span className="text-[22px] text-ice">%</span></p>
          <div className="mt-6 h-2 rounded-full bg-white/15"><div className="landing-progress h-full w-[76%] rounded-full bg-ice" /></div>
          <div className="mt-7 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] text-white/55">Present</p><p className="mt-1 text-lg font-bold">84</p></div><div className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] text-white/55">Review</p><p className="mt-1 text-lg font-bold">03</p></div></div>
        </div>
        <div className="space-y-3 p-1">
          <div className="rounded-[22px] border border-line bg-snow p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-muted">Workspace pulse</span><IconSymbol name="chart.bar.fill" size={18} color={palette.blue} /></div><div className="mt-5 flex items-end gap-1.5">{[32, 48, 39, 66, 55, 78, 64, 88].map((height, index) => <span key={index} className="landing-bar flex-1 rounded-t-md bg-blue/25" style={{ height: `${height}px` }} />)}</div></div>
          <div className="rounded-[22px] border border-line bg-white p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-muted">Next action</span><IconSymbol name="arrow.right" size={16} color={palette.blue} /></div><p className="mt-5 text-sm font-extrabold text-ink">Review team requests</p><p className="mt-1 text-[11px] leading-5 text-muted">Keep assignments explicit before the next shift.</p></div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const root = useRef(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = gsap.context(() => {
      if (reduceMotion) return;
      gsap.from("[data-hero]", { y: 28, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: "power3.out" });
      gsap.from("[data-preview]", { y: 34, rotate: 1.5, autoAlpha: 0, duration: 1, delay: 0.2, ease: "power3.out" });
      gsap.utils.toArray("[data-reveal]").forEach((element) => {
        gsap.from(element, { y: 34, autoAlpha: 0, duration: 0.75, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 84%", once: true } });
      });
      gsap.to("[data-progress]", { scaleX: 1, transformOrigin: "left center", ease: "none", scrollTrigger: { trigger: "[data-process]", start: "top 70%", end: "bottom 55%", scrub: true } });
      gsap.to("[data-float]", { y: -16, ease: "none", scrollTrigger: { trigger: "[data-float]", start: "top bottom", end: "bottom top", scrub: true } });
    }, root);
    return () => context.revert();
  }, []);

  const goToLogin = () => navigate("/login");
  const goToDemo = () => navigate("/demo");
  const goToRegister = () => navigate("/register");

  return (
    <div ref={root} className="min-h-screen overflow-x-hidden bg-snow text-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-snow/88 px-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5" aria-label="Facial Recognition Attendance home"><AppMark size={30} /><span className="text-[16px] font-extrabold tracking-[-0.02em]">Facial Recognition Attendance</span></button>
          <nav className="hidden items-center gap-7 text-[12px] font-bold text-muted md:flex" aria-label="Marketing navigation"><a href="#product" className="transition-colors hover:text-ink">Product</a><a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a><a href="#security" className="transition-colors hover:text-ink">Security</a><a href="#faq" className="transition-colors hover:text-ink">FAQ</a></nav>
          <div className="hidden items-center gap-2 sm:flex"><button type="button" onClick={goToLogin} className="rounded-xl bg-ink px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_8px_22px_rgba(16,24,40,0.16)] transition-transform hover:-translate-y-0.5">Sign in</button><button type="button" onClick={goToRegister} className="rounded-xl border border-line bg-white px-4 py-2.5 text-[12px] font-bold text-ink transition-colors hover:bg-sky-soft">Create account</button></div>
          <button type="button" onClick={() => setMobileMenu((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink shadow-sm ring-1 ring-line sm:hidden" aria-expanded={mobileMenu} aria-controls="marketing-menu" aria-label="Toggle marketing menu"><IconSymbol name={mobileMenu ? "xmark" : "line.3.horizontal"} size={19} color={palette.ink} /></button>
        </div>
        {mobileMenu && <div id="marketing-menu" className="border-t border-line/70 py-3 sm:hidden"><div className="mx-auto flex max-w-6xl flex-col gap-1"><a onClick={() => setMobileMenu(false)} href="#product" className="rounded-xl px-3 py-3 text-[13px] font-bold text-muted hover:bg-sky-soft">Product</a><a onClick={() => setMobileMenu(false)} href="#how-it-works" className="rounded-xl px-3 py-3 text-[13px] font-bold text-muted hover:bg-sky-soft">How it works</a><a onClick={() => setMobileMenu(false)} href="#security" className="rounded-xl px-3 py-3 text-[13px] font-bold text-muted hover:bg-sky-soft">Security</a><button type="button" onClick={goToLogin} className="mt-2 rounded-xl bg-ink px-4 py-3 text-left text-[13px] font-bold text-white">Sign in to workspace</button></div></div>}
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:pt-32">
          <div className="pointer-events-none absolute -left-32 top-8 h-96 w-96 rounded-full bg-ice/50 blur-3xl" /><div className="pointer-events-none absolute -right-32 top-20 h-[28rem] w-[28rem] rounded-full bg-vanilla/60 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
            <div><p data-hero className="inline-flex items-center gap-2 rounded-full border border-blue/20 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-blue-deep"><span className="h-1.5 w-1.5 rounded-full bg-blue" /> For organization-led work</p><h1 data-hero className="mt-6 max-w-[650px] text-[clamp(46px,7vw,82px)] font-extrabold leading-[0.96] tracking-[-0.065em]">A clearer way to run <span className="text-blue">attendance.</span></h1><p data-hero className="mt-6 max-w-[560px] text-[16px] leading-7 text-muted sm:text-[18px]">Facial Recognition Attendance gives HR, managers, and employees one calm system for provisioning, check-ins, team context, and reviewable signals.</p><div data-hero className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={goToRegister} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-[13px] font-bold text-white shadow-[0_16px_32px_rgba(16,24,40,0.18)] transition-transform hover:-translate-y-0.5">Create an organization <IconSymbol name="arrow.up.right" size={15} color="#fff" /></button><button type="button" onClick={goToDemo} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-5 py-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-sky-soft">View sample data <IconSymbol name="arrow.right" size={14} color={palette.blue} /></button></div><p data-hero className="mt-5 text-[11px] font-bold text-muted">Run the workspace locally with the organization in control.</p></div>
            <div data-preview data-float className="relative mx-auto w-full max-w-[560px] lg:ml-auto"><div className="absolute -inset-6 rounded-[40px] bg-blue/10 blur-3xl" /><ProductPreview /></div>
          </div>
        </section>

        <section className="border-y border-line/70 bg-white px-4 py-8 sm:px-6"><div data-reveal className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4"><div><p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-blue">Owner</p><p className="mt-1 text-[12px] font-bold text-muted">sets the boundary</p></div><div><p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-blue">HR</p><p className="mt-1 text-[12px] font-bold text-muted">provisions the people</p></div><div><p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-blue">Manager</p><p className="mt-1 text-[12px] font-bold text-muted">coordinates the team</p></div><div><p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-blue">Employee</p><p className="mt-1 text-[12px] font-bold text-muted">records the day</p></div></div></section>

        <section id="product" className="px-4 py-20 sm:px-6 sm:py-28"><div className="mx-auto max-w-6xl"><div data-reveal className="max-w-2xl"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue">One system, clear roles</p><h2 className="mt-4 text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.02] tracking-[-0.055em]">Less ambiguity for the people who keep work moving.</h2><p className="mt-5 text-[16px] leading-7 text-muted">The product follows the organization chart instead of asking everyone to learn the same crowded workspace.</p></div><div className="mt-12 grid gap-4 md:grid-cols-3">{features.map((feature, index) => <article data-reveal key={feature.title} className={`rounded-[28px] border p-6 sm:p-7 ${index === 1 ? "border-blue/20 bg-sky-soft" : "border-line bg-white"}`}><div className="flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue">{feature.eyebrow}</span><IconSymbol name={feature.icon} size={23} color={index === 2 ? palette.gold : palette.blue} /></div><h3 className="mt-14 text-[20px] font-extrabold tracking-[-0.03em] text-ink">{feature.title}</h3><p className="mt-3 text-[13px] leading-6 text-muted">{feature.text}</p></article>)}</div></div></section>

        <section id="how-it-works" data-process className="bg-blue-deep px-4 py-20 text-white sm:px-6 sm:py-28"><div className="mx-auto max-w-6xl"><div data-reveal className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-end"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ice">A calmer rollout</p><h2 className="mt-4 text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.02] tracking-[-0.055em]">From first account to first check-in.</h2><p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">A small number of explicit steps keeps rollout understandable for every role.</p><div className="mt-10 h-px w-full bg-white/15"><div data-progress className="h-full origin-left scale-x-0 bg-ice" /></div></div><div className="grid gap-3 md:grid-cols-3">{steps.map((step) => <div data-reveal key={step.number} className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-sm"><span className="text-[11px] font-extrabold text-ice">{step.number}</span><h3 className="mt-10 text-[16px] font-extrabold">{step.title}</h3><p className="mt-3 text-[12px] leading-5 text-white/60">{step.text}</p></div>)}</div></div></div></section>

        <section id="security" className="px-4 py-20 sm:px-6 sm:py-28"><div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.78fr_1.22fr]"><div data-reveal><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue">Built for trust</p><h2 className="mt-4 text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.02] tracking-[-0.055em]">Security should clarify the work.</h2><p className="mt-5 max-w-md text-[15px] leading-7 text-muted">Sensitive actions stay behind authenticated, role-aware boundaries. The public page never needs private workspace data.</p></div><div className="grid gap-3 sm:grid-cols-2"><div data-reveal className="rounded-[24px] border border-line bg-white p-6"><IconSymbol name="shield.fill" size={24} color={palette.blue} /><h3 className="mt-5 text-[16px] font-extrabold text-ink">Consent-first capture</h3><p className="mt-2 text-[13px] leading-6 text-muted">Employees enroll their own attendance photo and receive clear feedback at every step.</p></div><div data-reveal className="rounded-[24px] border border-line bg-white p-6"><IconSymbol name="lock.fill" size={24} color={palette.gold} /><h3 className="mt-5 text-[16px] font-extrabold text-ink">Role-aware access</h3><p className="mt-2 text-[13px] leading-6 text-muted">HR, managers, and employees get tools that reflect their responsibility.</p></div><div data-reveal className="rounded-[24px] border border-line bg-sky-soft p-6"><IconSymbol name="chart.bar.fill" size={24} color={palette.blue} /><h3 className="mt-5 text-[16px] font-extrabold text-ink">Reviewable signals</h3><p className="mt-2 text-[13px] leading-6 text-muted">Insights support review; they never become automatic employment decisions.</p></div><div data-reveal className="rounded-[24px] border border-line bg-vanilla-soft p-6"><IconSymbol name="checkmark.seal.fill" size={24} color={palette.gold} /><h3 className="mt-5 text-[16px] font-extrabold text-ink">Local control</h3><p className="mt-2 text-[13px] leading-6 text-muted">Keep organization data and attendance workflows under your control.</p></div></div></div></section>

        <section id="faq" className="border-y border-line/70 bg-white px-4 py-20 sm:px-6 sm:py-28"><div className="mx-auto max-w-3xl"><div data-reveal className="text-center"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue">Questions, answered</p><h2 className="mt-4 text-[clamp(34px,5vw,52px)] font-extrabold leading-[1.02] tracking-[-0.055em]">Start with clarity.</h2></div><div className="mt-10 space-y-3">{faqs.map((faq, index) => <div data-reveal key={faq.q} className="rounded-[22px] border border-line bg-snow p-5"><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 text-left" aria-expanded={openFaq === index}><span className="text-[14px] font-extrabold text-ink">{faq.q}</span><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white transition-transform duration-300 ${openFaq === index ? "rotate-45" : ""}`}><IconSymbol name="plus" size={15} color={palette.ink} /></span></button>{openFaq === index && <p className="mt-4 max-w-2xl text-[13px] leading-6 text-muted">{faq.a}</p>}</div>)}</div></div></section>

        <section className="px-4 py-16 sm:px-6 sm:py-24"><div data-reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-blue-deep px-6 py-12 text-white sm:px-12 sm:py-16"><div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-vanilla/20 blur-3xl" /><div className="relative max-w-2xl"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ice">Ready when your organization is</p><h2 className="mt-4 text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.02] tracking-[-0.055em]">Make attendance a calmer part of the workday.</h2><p className="mt-5 max-w-xl text-[15px] leading-7 text-white/70">See a labelled sample workspace first, or create an organization account for the real flow.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={goToRegister} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-[13px] font-bold text-blue-deep transition-transform hover:-translate-y-0.5">Create organization <IconSymbol name="arrow.up.right" size={15} color={palette.blueDeep} /></button><button type="button" onClick={goToDemo} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 px-5 py-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/10">View sample data <IconSymbol name="arrow.right" size={15} color="#fff" /></button></div></div></div></section>
      </main>

      <footer className="border-t border-line/70 bg-white px-4 py-8 sm:px-6"><div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2.5"><AppMark size={26} /><span className="text-[14px] font-extrabold text-ink">Facial Recognition Attendance</span></div><p className="text-[11px] text-muted">© 2026 Facial Recognition Attendance. Built for organization-led work.</p><div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-muted"><a href="#security" className="hover:text-ink">Security</a><a href="#faq" className="hover:text-ink">FAQ</a><a href="https://github.com/Moeed-S-E/ai-facial-attendance" className="hover:text-ink">Source code</a></div></div></footer>
    </div>
  );
}
