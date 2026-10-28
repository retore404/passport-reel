import { SAMPLE_VISITED_COUNTRIES } from "./sampleVisitedCountries";
import { WorldMapCanvas } from "./WorldMapCanvas";

export function App() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <h1>Passport Reel</h1>
      <WorldMapCanvas visited={SAMPLE_VISITED_COUNTRIES} />
    </main>
  );
}
