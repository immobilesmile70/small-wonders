import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  StaticTopographyFallback,
  type ObservatorySpecimenKey,
} from '../../components/three/PaperTopographyScene';
import { Button, CategoryLabel } from '../../components/ui/Primitives';
import type { EntryCategory } from '../../types/journal';

const LazyPaperTopographyScene = lazy(
  () => import('../../components/three/PaperTopographyScene')
);

interface IllustrativeEntry {
  indexCode: string;
  category: EntryCategory;
  title: string;
  note: string;
  tags: string[];
  placeLabel: string;
  dateLabel: string;
}

const ILLUSTRATIVE_SPECIMENS: Record<string, IllustrativeEntry> = {
  Light: {
    indexCode: 'OBS-042',
    category: 'Light',
    title: 'The last rectangle of sunlight on the kitchen floor',
    note: 'At 4:40 PM a narrow band of vermilion light clears the neighboring roofline and rests across the dark tiles for twelve minutes before fading.',
    tags: ['afternoon', 'kitchen', 'solstice'],
    placeLabel: 'Kitchen doorway',
    dateLabel: '29 Oct, 16:40',
  },
  Nature: {
    indexCode: 'OBS-039',
    category: 'Nature',
    title: 'A tiny fern growing between two paving stones',
    note: 'Three delicate green fronds rooted in half a teaspoon of damp grit beside the steps, untouched by the evening rush.',
    tags: ['botany', 'pavement', 'rain'],
    placeLabel: 'Mercer Street steps',
    dateLabel: '27 Oct, 08:15',
  },
  Sound: {
    indexCode: 'OBS-034',
    category: 'Sound',
    title: 'The sound the old station clock makes before it strikes',
    note: 'Five seconds before the hour, the brass escapement gives a quiet metallic catch that you can only hear when the platform is empty.',
    tags: ['clockwork', 'platform', 'evening'],
    placeLabel: 'Suburban rail platform',
    dateLabel: '25 Oct, 18:59',
  },
  Architecture: {
    indexCode: 'OBS-028',
    category: 'Architecture',
    title: 'Carved stone lintel worn smooth by a century of rain',
    note: 'Above the side entrance of the municipal library, the limestone acanthus leaves have softened into rounded river-stone contours.',
    tags: ['limestone', 'library', 'craft'],
    placeLabel: 'Old Library North Door',
    dateLabel: '22 Oct, 14:10',
  },
};

const OBSERVATORY_CARDS: Array<{
  specimenKey: ObservatorySpecimenKey;
  quote: string;
  context: string;
  detail: string;
}> = [
  {
    specimenKey: 'Light',
    quote: 'The last rectangle of sunlight on the kitchen floor.',
    context: 'SPECIMEN 01 · LIGHT · 16:42',
    detail: 'Refractive solstice prism and courtyard shadow relief.',
  },
  {
    specimenKey: 'Nature',
    quote: 'A tiny fern growing between two paving stones.',
    context: 'SPECIMEN 02 · NATURE · 08:15',
    detail: 'Fractured basalt crevice and unfurling botanical frond.',
  },
  {
    specimenKey: 'Sound',
    quote: 'The sound the old station clock makes before it strikes.',
    context: 'SPECIMEN 03 · SOUND · 18:59',
    detail: 'Concentric acoustic wavefield and clockwork resonator.',
  },
];

function formatClockTime(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export const LandingPage: React.FC = () => {
  const [activeDemoCategory, setActiveDemoCategory] = useState<string>('Light');
  const [observatorySpecimen, setObservatorySpecimen] = useState<ObservatorySpecimenKey>('Light');
  const [clockText, setClockText] = useState<string>(() => formatClockTime());

  const activeSpecimen = ILLUSTRATIVE_SPECIMENS[activeDemoCategory] || ILLUSTRATIVE_SPECIMENS.Light;

  useEffect(() => {
    const timer = setInterval(() => setClockText(formatClockTime()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      {/* ASYMMETRIC LEFT-ALIGNED HERO: Plain spoken thesis + Live HTML Field Specimen Card (SKILL.md §3) */}
      <section
        style={{
          position: 'relative',
          minHeight: '92dvh',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          paddingTop: '7.5rem',
          paddingBottom: '5rem',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <img
            src="/images/vermilion-botanical-void.jpg"
            alt=""
            className="hero-backdrop-img"
          />
          <div className="hero-backdrop-gradient" />
        </div>

        <div className="premium-container" style={{ position: 'relative', zIndex: 10 }}>
          <div className="grid-12" style={{ alignItems: 'center' }}>
            {/* Left 7 Columns: Left-aligned editorial thesis & actions */}
            <div className="col-span-7" style={{ textAlign: 'left' }}>
              <div
                className="font-mono-meta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '1.25rem',
                }}
              >
                <span id="current-time">{clockText}</span>
                <span style={{ width: '1px', height: '11px', backgroundColor: 'var(--line-strong)' }} />
                <span>PERSONAL FIELD JOURNAL</span>
              </div>

              <h1 className="hero-glow-title" style={{ marginBottom: '1.25rem', maxWidth: '18ch' }}>
                Not everything meaningful announces itself.
              </h1>

              <p
                className="hero-glow-subtitle"
                style={{
                  fontSize: 'var(--step-1)',
                  marginBottom: '2.25rem',
                }}
              >
                A private digital fieldbook for recording the light, sounds, worn architecture, and quiet details of an ordinary day before they fade.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center' }}>
                <Link to="/sign-up" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="lg">
                    Start your journal
                  </Button>
                </Link>
                <a href="#the-idea" className="btn-pill btn-secondary btn-pill-lg">
                  Inspect the observatory
                </a>
              </div>
            </div>

            {/* Right 5 Columns: Live HTML Specimen Card (Characteristic Product Artifact) */}
            <div className="col-span-5">
              <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '0.85rem', borderBottom: '1px solid var(--line)' }}>
                  <div role="group" aria-label="Specimen lens filter" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {Object.keys(ILLUSTRATIVE_SPECIMENS).map((catKey) => {
                      const isSel = activeDemoCategory === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          className="lens-pill"
                          onClick={() => setActiveDemoCategory(catKey)}
                          aria-pressed={isSel}
                        >
                          {catKey}
                        </button>
                      );
                    })}
                  </div>
                  <span className="index-pill">{activeSpecimen.indexCode}</span>
                </div>

                <div aria-live="polite">
                  <div style={{ marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <CategoryLabel category={activeSpecimen.category} />
                    <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
                      {activeSpecimen.dateLabel} · {activeSpecimen.placeLabel}
                    </span>
                  </div>
                  <h2 className="heading-card" style={{ marginBottom: '0.65rem' }}>
                    {activeSpecimen.title}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.96rem', lineHeight: 1.65, margin: 0 }}>
                    {activeSpecimen.note}
                  </p>
                </div>

                <div style={{ paddingTop: '0.85rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {activeSpecimen.tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="font-mono-meta" style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                    PRIVATE UID RECORD
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE 3D TOPOGRAPHIC OBSERVATORY (#the-idea) */}
      <section id="the-idea" className="section-band" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="premium-container">
          <div style={{ maxWidth: '680px', marginBottom: '3rem' }}>
            <p className="font-mono-meta" style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0' }}>
              CARTOGRAPHIC SPECIMEN INSTRUMENT
            </p>
            <h2 className="heading-section" style={{ marginBottom: '1rem' }}>
              Designed for quiet attention, not public performance.
            </h2>
            <p style={{ fontSize: 'var(--step-0)', color: 'var(--text-muted)', margin: 0 }}>
              We stripped away streaks, follower counts, and algorithmic feeds so the observations you collect remain personal. Select a field specimen below or drag the 3D relief to inspect how light, botany, and sound map onto a day.
            </p>
          </div>

          <div className="grid-12" style={{ alignItems: 'stretch' }}>
            <div className="col-span-7">
              <Suspense fallback={<StaticTopographyFallback sunAngle={0.62} specimen={observatorySpecimen} />}>
                <LazyPaperTopographyScene
                  activeSpecimen={observatorySpecimen}
                  onSelectSpecimen={setObservatorySpecimen}
                />
              </Suspense>
            </div>

            <div className="col-span-5" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
              {OBSERVATORY_CARDS.map((item) => {
                const isSelected = observatorySpecimen === item.specimenKey;
                return (
                  <button
                    key={item.specimenKey}
                    type="button"
                    className={`specimen-quote-card${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => setObservatorySpecimen(item.specimenKey)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="font-mono-meta" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {item.context}
                      </span>
                      <span className="font-mono-meta card-action-cue" style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                        {isSelected ? 'ACTIVE IN 3D' : 'INSPECT 3D →'}
                      </span>
                    </div>
                    <p className="font-serif" style={{ fontSize: '1.3rem', margin: '0 0 0.4rem 0', color: 'var(--text)' }}>
                      “{item.quote}”
                    </p>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                      {item.detail}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ANATOMY OF A FIELD RECORD & SECURITY ARCHITECTURE (#works) */}
      <section
        id="works"
        className="section-band dot-grid-bg"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div className="premium-container">
          <div className="grid-12" style={{ alignItems: 'start' }}>
            <div className="col-span-5">
              <p className="font-mono-meta" style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0' }}>
                FIELD ENTRY SPECIFICATION
              </p>
              <h2 className="heading-section" style={{ marginBottom: '1rem' }}>
                Built like an archival ledger, down to the database rules.
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', marginBottom: '1.75rem' }}>
                Every entry captures just enough context to anchor a memory in thirty seconds, stored under strict owner-isolated Firestore paths.
              </p>
              <Link to="/sign-up" style={{ textDecoration: 'none' }}>
                <Button variant="primary">Create your notebook</Button>
              </Link>
            </div>

            <div className="col-span-7">
              <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
                {[
                  {
                    code: 'FIELD 01 · TITLE & NOTE',
                    title: 'Structured 80-character title & 500-character observation',
                    desc: 'Constrained measure keeps entries concise and readable like a physical pocket notebook rather than an endless document.',
                  },
                  {
                    code: 'FIELD 02 · SIX LENSES & NORMALIZED TAGS',
                    title: 'Categorized by Light, Nature, Architecture, People, Sound, or Unexpected',
                    desc: 'Attach up to 5 lowercase normalized tags per entry and filter loaded archive pages instantaneously without full-collection scans.',
                  },
                  {
                    code: 'FIELD 03 · MANUAL PLACE LABEL (ZERO GPS)',
                    title: 'Human place descriptions without background location tracking',
                    desc: 'Record "East stairwell window" or "Mercer Street steps" in your own words. Small Wonders never asks for device geolocation.',
                  },
                  {
                    code: 'FIELD 04 · VERIFIED SERVERLESS MUTATIONS',
                    title: 'Read-only client Firestore rules paired with rate-limited API writes',
                    desc: 'Direct client writes are blocked at the security-rule layer; every create, edit, and delete is verified via Firebase Admin ID tokens and Upstash rate limits.',
                  },
                ].map((row, idx) => (
                  <div
                    key={row.code}
                    style={{
                      padding: '1.35rem 1.65rem',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                    }}
                  >
                    <span className="font-mono-meta" style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
                      {row.code}
                    </span>
                    <h3 className="font-serif" style={{ fontSize: '1.2rem', margin: 0 }}>
                      {row.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
                      {row.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING INVITATION SECTION */}
      <section className="section-band">
        <div className="premium-container">
          <div
            className="glass"
            style={{
              padding: '2.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '2rem',
            }}
          >
            <div style={{ maxWidth: '56ch' }}>
              <p className="font-mono-meta" style={{ color: 'var(--accent)', margin: '0 0 0.4rem 0' }}>
                PRIVATE BY DEFAULT
              </p>
              <h2 className="heading-card" style={{ fontSize: 'var(--step-3)', marginBottom: '0.5rem' }}>
                Begin keeping your own record of small wonders.
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', margin: 0 }}>
                Starter observations are ready in the sandbox so you can explore the notebook, archive filters, and JSON export right away.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/sign-up" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg">
                  Start your journal
                </Button>
              </Link>
              <Link to="/sign-in" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" size="lg">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
