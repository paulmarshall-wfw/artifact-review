import { useEffect, useState } from "react";
import { StatusPill } from "./components/StatusPill";
import { getSetupReadiness, type SetupReadiness } from "./lib/api";

const sampleSections = [
  {
    title: "Executive Summary",
    decision: "Unreviewed",
    readiness: "Draft",
    components: [
      "Artifact Review turns imported documents into stable review components.",
      "Provider-backed tasks create proposed changes, not automatic edits."
    ]
  },
  {
    title: "Provider Runtime",
    decision: "Needs changes",
    readiness: "Needs evidence",
    components: [
      "Registry profiles and provider configs stay in the shared registry.",
      "Task definitions, prompt versions, hooks, runs, and suggestions are app-owned."
    ]
  }
];

export function App() {
  const [readiness, setReadiness] = useState<SetupReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSetupReadiness()
      .then(setReadiness)
      .catch((unknownError: unknown) => {
        setError(unknownError instanceof Error ? unknownError.message : "Unable to load setup readiness.");
      });
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <div className="brand">Artifact Review</div>
            <div className="version">v0.1.0</div>
          </div>
          <button className="icon-button" aria-label="Toggle theme" title="Toggle theme">
            ◐
          </button>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <a className="nav-item active" href="#review">Review</a>
          <a className="nav-item" href="#setup">Setup</a>
          <a className="nav-item" href="#runs">Task Runs</a>
          <a className="nav-item" href="#exports">Exports</a>
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="page-label">Review Workspace</div>
            <h1>Document Review</h1>
          </div>
          <div className="topbar-actions">
            <input className="search" placeholder="Search components" aria-label="Search components" />
            <button>Open</button>
            <button>Export</button>
          </div>
        </header>

        <section className="setup-strip" id="setup">
          <div>
            <strong>Setup readiness</strong>
            <p>Provider-backed actions stay disabled until required runtime checks pass.</p>
          </div>
          <div className="readiness-grid">
            {error ? <span className="error-text">{error}</span> : null}
            {readiness?.checks.map((item) => (
              <div className="readiness-item" key={item.key}>
                <span>{item.label}</span>
                <StatusPill item={item} />
              </div>
            ))}
          </div>
        </section>

        <section className="review-layout" id="review">
          <div className="section-list">
            {sampleSections.map((section) => (
              <article className="review-section" key={section.title}>
                <div className="section-header">
                  <h2>{section.title}</h2>
                  <div className="segmented">
                    <button>{section.decision}</button>
                    <button>{section.readiness}</button>
                  </div>
                </div>
                <div className="component-list">
                  {section.components.map((component) => (
                    <div className="review-component" key={component}>
                      <p>{component}</p>
                      <div className="component-actions">
                        <button>Highlight</button>
                        <button>Annotate</button>
                        <button>Evidence</button>
                        <button disabled={!readiness?.ready} title="Requires setup readiness">
                          AI Suggest
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <aside className="detail-panel">
            <h2>Component Detail</h2>
            <dl>
              <dt>Task</dt>
              <dd>suggest-component-revision</dd>
              <dt>Prompt</dt>
              <dd>0.1.0</dd>
              <dt>Provider</dt>
              <dd>Waiting for selected profile</dd>
              <dt>External send</dt>
              <dd>Shown before invocation</dd>
            </dl>
          </aside>
        </section>
      </main>
    </div>
  );
}

