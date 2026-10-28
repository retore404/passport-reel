import { SAMPLE_VISITED_COUNTRIES } from "./sampleVisitedCountries";
import { WorldMapCanvas } from "./WorldMapCanvas";

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-logo" aria-hidden="true" />
          Passport Reel
        </h1>
      </header>
      <main className="map-stage">
        <WorldMapCanvas visited={SAMPLE_VISITED_COUNTRIES} />
      </main>
    </div>
  );
}
