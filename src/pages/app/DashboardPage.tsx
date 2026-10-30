import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  CategoryLabel,
  SkeletonEntriesList,
  SpotlightCard,
} from '../../components/ui/Primitives';
import { useAuth } from '../../features/auth/AuthContext';
import { useJournal } from '../../features/journal/JournalContext';
import { DAILY_OBSERVATION_PROMPTS } from '../../lib/designSystem';

export function formatReadableDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(isoString));
  } catch {
    return isoString.slice(0, 10);
  }
}

export function formatReadableTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return '';
  }
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { entries, isLoading, error, insights, loadFirstPage } = useJournal();
  const [promptIndex, setPromptIndex] = useState(0);

  const todayFormatted = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    []
  );

  const greetingName = useMemo(() => {
    if (user?.displayName) return user.displayName.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'Observer';
  }, [user]);

  const currentPrompt =
    DAILY_OBSERVATION_PROMPTS[promptIndex % DAILY_OBSERVATION_PROMPTS.length];

  const recentEntries = entries.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* App Header Band */}
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--space-3)',
          paddingBottom: 'var(--space-3)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div>
          <p className="font-mono-meta" style={{ color: 'var(--accent-b)', margin: '0 0 var(--space-1) 0' }}>
            {todayFormatted} / Notebook of {greetingName}
          </p>
          <h1 className="heading-section display-gradient" style={{ marginBottom: 'var(--space-1)' }}>
            There is still something to notice.
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', margin: 0 }}>
            {insights.entriesLastSevenDays === 0
              ? 'Your pages are quiet this week. Whenever a small detail catches your eye today, set it down in a sentence or two.'
              : `You have recorded ${insights.entriesLastSevenDays} ${
                  insights.entriesLastSevenDays === 1 ? 'observation' : 'observations'
                } in the last seven days.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Link to="/app/new" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg">
              Record an observation
            </Button>
          </Link>
          <Link to="/app/journal" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">
              Browse archive
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured Glass Field Prompt Panel (Section 7.3 of premium-design: reserve glass/edge for featured panels) */}
      <section
        aria-label="Daily observation prompt"
        className="glass edge"
        style={{
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ maxWidth: '62ch' }}>
          <span className="font-mono-meta" style={{ color: 'var(--accent-b)' }}>
            FIELD PROMPT
          </span>
          <p
            className="heading-card"
            style={{ margin: 'var(--space-1) 0' }}
          >
            “{currentPrompt}”
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)', margin: 0 }}>
            {insights.reflectionPrompt}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPromptIndex((prev) => prev + 1)}
          >
            Another prompt
          </Button>
          <Link
            to={`/app/new?prompt=${encodeURIComponent(currentPrompt)}`}
            style={{ textDecoration: 'none' }}
          >
            <Button variant="primary" size="sm">
              Write from this prompt
            </Button>
          </Link>
        </div>
      </section>

      {/* Main Split: Recent Entries & Lightweight Personal Insights */}
      <div className="grid-12" style={{ alignItems: 'start' }}>
        <section className="col-span-7" aria-labelledby="recent-observations-heading">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-2)',
            }}
          >
            <h2 id="recent-observations-heading" className="heading-card" style={{ margin: 0 }}>
              Recent observations
            </h2>
            <Link
              to="/app/journal"
              style={{ fontSize: 'var(--step--1)', color: 'var(--accent-b)', fontWeight: 500 }}
            >
              Full archive ({entries.length})
            </Link>
          </div>

          {isLoading ? (
            <SkeletonEntriesList rows={3} />
          ) : error ? (
            <div
              role="alert"
              className="surface-panel"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              <p style={{ margin: '0 0 var(--space-2) 0' }}>{error}</p>
              <Button variant="secondary" size="sm" onClick={() => void loadFirstPage()}>
                Retry loading journal
              </Button>
            </div>
          ) : recentEntries.length === 0 ? (
            <div className="glass edge" style={{ padding: 'var(--space-4)' }}>
              <h3 className="heading-card" style={{ marginBottom: 'var(--space-1)' }}>
                Your field journal has no entries yet
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                Record your first observation to begin building your personal archive of everyday details.
              </p>
              <Link to="/app/new" style={{ textDecoration: 'none' }}>
                <Button variant="primary">Record your first observation</Button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {recentEntries.map((entry) => (
                <SpotlightCard key={entry.id} as="article">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      marginBottom: 'var(--space-1)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
                      {formatReadableDate(entry.observedAt)}
                      {entry.placeLabel ? ` / ${entry.placeLabel}` : ''}
                    </span>
                    <CategoryLabel category={entry.category} />
                  </div>

                  <h3 className="heading-card" style={{ margin: '0 0 var(--space-1) 0' }}>
                    <Link
                      to={`/app/journal/${entry.id}`}
                      style={{ color: 'var(--text)', textDecoration: 'none' }}
                    >
                      {entry.title}
                    </Link>
                  </h3>

                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 'var(--step-0)',
                      margin: '0 0 var(--space-2) 0',
                    }}
                  >
                    {entry.note.length > 160 ? `${entry.note.slice(0, 160)}...` : entry.note}
                  </p>

                  {entry.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                      {entry.tags.map((tag) => (
                        <span key={tag} className="tag-chip">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </SpotlightCard>
              ))}
            </div>
          )}
        </section>

        <aside
          className="col-span-5 surface-panel"
          aria-labelledby="weekly-patterns-heading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <span className="font-mono-meta" style={{ color: 'var(--accent-b)' }}>
              REPORTING WINDOW: {insights.reportingPeriodLabel.toUpperCase()}
            </span>
            <h2
              id="weekly-patterns-heading"
              className="heading-card"
              style={{ margin: 'var(--space-1) 0 0 0' }}
            >
              Seven-day observation rhythm
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 'var(--space-1)',
              textAlign: 'center',
            }}
          >
            {insights.dailyActivity.map((day) => (
              <div
                key={day.dateIso}
                style={{
                  padding: 'var(--space-1) 0.25rem',
                  backgroundColor: day.count > 0 ? 'var(--surface-2)' : 'var(--canvas)',
                  border: `1px solid ${
                    day.count > 0 ? 'var(--accent-a)' : 'var(--line)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
                  {day.dayLabel}
                </div>
                <div
                  className="font-mono-meta"
                  style={{
                    fontSize: 'var(--step-0)',
                    fontWeight: 600,
                    marginTop: '0.2rem',
                    color: day.count > 0 ? 'var(--accent-b)' : 'var(--text-muted)',
                  }}
                >
                  {day.count}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--step--1)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Most frequented categories in loaded sample ({insights.totalEntriesInSample})
            </h3>
            {insights.totalEntriesInSample === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)', margin: 0 }}>
                Categories will appear here once you save your first observation.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {insights.categoryDistribution
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <div
                      key={item.category}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 'var(--step--1)',
                        padding: '0.35rem 0',
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      <span>{item.category}</span>
                      <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--step--1)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Recurring tags
            </h3>
            {insights.recentTags.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)', margin: 0 }}>
                Add optional tags to your observations to track recurring motifs.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {insights.recentTags.map((t) => (
                  <Link
                    key={t.tag}
                    to={`/app/journal?q=${encodeURIComponent(t.tag)}`}
                    className="tag-chip"
                  >
                    #{t.tag} ({t.count})
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
