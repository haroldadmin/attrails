import { ExportGuide, exportGuideMetadata } from "../export-guide";

export const metadata = exportGuideMetadata("Strava");

export default function StravaExportPage() {
  return (
    <ExportGuide
      name="Strava"
      helpUrl="https://support.strava.com/en-us/articles/15401919-how-do-i-export-my-strava-data"
    >
      <p className="lead">
        Strava lets you download routes and your own activities as GPX files.
        These steps use the Strava website.
      </p>

      <section aria-labelledby="route-heading">
        <h2 id="route-heading">A route</h2>
        <ol>
          <li>On strava.com, open the route.</li>
          <li>Click the download icon (a down arrow).</li>
          <li>
            Choose <strong>GPX</strong>.
          </li>
        </ol>
        <p>You can export your own routes and any public route.</p>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading">One of your activities</h2>
        <ol>
          <li>On strava.com, open the activity.</li>
          <li>
            Open the <strong>⋯</strong> menu and choose{" "}
            <strong>Export GPX</strong>.
          </li>
        </ol>
      </section>
    </ExportGuide>
  );
}
