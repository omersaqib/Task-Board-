/** Static, decorative sample ledger shown beside the auth forms on wide screens. */
const SAMPLE = [
  {
    title: 'Renew the staging certificate',
    priority: 'high',
    status: 'in_progress',
    hint: 'overdue',
  },
  { title: 'Write the release notes', priority: 'medium', status: 'todo', hint: 'due soon' },
  { title: 'Book the offsite venue', priority: 'low', status: 'done', hint: '' },
] as const;

export function AuthAside() {
  return (
    <div className="tb-auth-aside" aria-hidden="true">
      <span className="tb-eyebrow">Your ledger</span>
      <p className="tb-title">Every task, one ruled line.</p>
      <ul className="tb-ledger">
        {SAMPLE.map((row) => (
          <li
            key={row.title}
            className={`tb-row tb-sample-row${row.status === 'done' ? ' tb-row--done' : ''}`}
          >
            <span className={`tb-glyph tb-glyph--${row.status}`} />
            <div className="tb-row__body">
              <p className="tb-row__title">{row.title}</p>
              <div className="tb-row__meta">
                <span className={`tb-priority tb-priority--${row.priority}`}>
                  <span className="tb-meter">
                    <i />
                    <i />
                    <i />
                  </span>
                  {row.priority}
                </span>
                {row.hint && (
                  <span
                    className={`tb-due-hint ${row.hint === 'overdue' ? 'tb-due-hint--overdue' : 'tb-due-hint--soon'}`}
                  >
                    {row.hint}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
