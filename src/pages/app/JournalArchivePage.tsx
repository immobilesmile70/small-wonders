import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  CategoryLabel,
  InputField,
  SkeletonEntriesList,
  SpotlightCard,
} from '../../components/ui/Primitives';
import { useJournal } from '../../features/journal/JournalContext';
import { filterLoadedEntriesBySearch } from '../../services/firestore-reads/entries';
import { ENTRY_CATEGORIES, type EntryCategory } from '../../types/journal';
import { formatReadableDate, formatReadableTime } from './DashboardPage';

export const JournalArchivePage: React.FC = () => {
  const {
    entries,
    isLoading,
    error,
    hasMore,
    selectedCategory,
    sortDirection,
    searchQuery,
    setSelectedCategory,
    setSortDirection,
    setSearchQuery,
    loadFirstPage,
    loadNextPage,
  } = useJournal();

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null && qParam !== searchQuery) {
      setSearchQuery(qParam);
    }
  }, [searchParams, searchQuery, setSearchQuery]);

  const displayedEntries = useMemo(
    () => filterLoadedEntriesBySearch(entries, searchQuery),
    [entries, searchQuery]
  );

  const hasActiveFilters =
    selectedCategory !== 'All' || sortDirection !== 'desc' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSortDirection('desc');
    setSearchQuery('');
    setSearchParams({});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--space-2)',
          paddingBottom: 'var(--space-3)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div>
          <p className="font-mono-meta" style={{ color: 'var(--accent-b)', margin: '0 0 var(--space-1) 0' }}>
            PERSONAL ARCHIVE
          </p>
          <h1 className="heading-section display-gradient" style={{ margin: 0 }}>
            Collected observations
          </h1>
        </div>

        <Link to="/app/new" style={{ textDecoration: 'none' }}>
          <Button variant="primary">Record an observation</Button>
        </Link>
      </header>

      {/* Search, Category Filter, and Sort Controls in a Glass Surface */}
      <section
        aria-label="Filter and search observations"
        className="glass"
        style={{
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-2)',
            alignItems: 'end',
          }}
        >
          <InputField
            label="Search loaded observations (title, note, place, or tag)"
            type="search"
            placeholder="Filter by keyword or #tag..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) {
                setSearchParams({ q: e.target.value });
              } else {
                setSearchParams({});
              }
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label
              htmlFor="archive-sort-select"
              style={{ fontSize: 'var(--step--1)', fontWeight: 500, color: 'var(--text)' }}
            >
              Order by observation date
            </label>
            <select
              id="archive-sort-select"
              className="select-control"
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value as 'desc' | 'asc')}
            >
              <option value="desc">Newest observations first</option>
              <option value="asc">Earliest observations first</option>
            </select>
          </div>
        </div>

        {/* Pill Category Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', alignItems: 'center' }}>
          <span
            className="font-mono-meta"
            style={{ color: 'var(--text-muted)', marginRight: 'var(--space-1)' }}
          >
            Category:
          </span>
          {(['All', ...ENTRY_CATEGORIES] as const).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Button
                key={cat}
                type="button"
                variant={active ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={active}
                onClick={() => setSelectedCategory(cat as EntryCategory | 'All')}
              >
                {cat}
              </Button>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-2)',
            paddingTop: 'var(--space-2)',
            borderTop: '1px solid var(--line)',
            fontSize: 'var(--step--1)',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            Showing <strong>{displayedEntries.length}</strong> of{' '}
            <strong>{entries.length}</strong> loaded observations
            {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}. Keyword search filters the currently loaded archive pages without downloading your entire collection at once.
          </span>
          {hasActiveFilters && (
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </section>

      {isLoading && entries.length === 0 ? (
        <SkeletonEntriesList rows={4} />
      ) : error ? (
        <div
          role="alert"
          className="surface-panel"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          <p style={{ margin: '0 0 var(--space-2) 0' }}>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadFirstPage()}>
            Retry
          </Button>
        </div>
      ) : displayedEntries.length === 0 ? (
        <div
          className="glass edge"
          style={{
            padding: 'var(--space-5) var(--space-4)',
            textAlign: 'center',
          }}
        >
          <h2 className="heading-card" style={{ marginBottom: 'var(--space-1)' }}>
            {hasActiveFilters
              ? 'No loaded observations match your current filter'
              : 'Your archive is empty'}
          </h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '46ch', margin: '0 auto var(--space-3)' }}>
            {hasActiveFilters
              ? 'Try clearing your search or category filter, or load additional archive pages below.'
              : 'Whenever you notice a quiet detail today, record it to start your collection.'}
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={handleResetFilters}>
              Reset all filters
            </Button>
          ) : (
            <Link to="/app/new" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Record an observation</Button>
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {displayedEntries.map((entry) => (
            <SpotlightCard key={entry.id} as="article">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-1)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
                  {formatReadableDate(entry.observedAt)} at {formatReadableTime(entry.observedAt)}
                  {entry.placeLabel ? ` / ${entry.placeLabel}` : ''}
                </span>
                <CategoryLabel category={entry.category} />
              </div>

              <h2 className="heading-card" style={{ margin: '0 0 var(--space-1) 0' }}>
                <Link
                  to={`/app/journal/${entry.id}`}
                  style={{ color: 'var(--text)', textDecoration: 'none' }}
                >
                  {entry.title}
                </Link>
              </h2>

              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 'var(--step-0)',
                  lineHeight: 1.65,
                  margin: '0 0 var(--space-2) 0',
                }}
              >
                {entry.note}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                  {entry.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSearchQuery(tag)}
                      className="tag-chip"
                      style={{ cursor: 'pointer' }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--step--1)' }}>
                  <Link
                    to={`/app/journal/${entry.id}`}
                    style={{ color: 'var(--accent-b)', fontWeight: 500 }}
                  >
                    Read entry
                  </Link>
                  <Link
                    to={`/app/journal/${entry.id}?edit=true`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            onClick={() => void loadNextPage()}
            isLoading={isLoading}
          >
            Load older observations
          </Button>
        </div>
      )}
    </div>
  );
};
