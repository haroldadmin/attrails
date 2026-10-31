import { ExportGuide, exportGuideMetadata } from "../export-guide";

export const metadata = exportGuideMetadata("AllTrails");

export default function AllTrailsExportPage() {
  return (
    <ExportGuide
      name="AllTrails"
      helpUrl="https://support.alltrails.com/hc/en-us/articles/37230403315476-Downloading-files-from-AllTrails"
    >
      <p className="lead">
        AllTrails lets you download your recorded activities, custom routes and
        trail maps as GPX files. These steps use AllTrails.com.
      </p>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading">One of your activities</h2>
        <ol>
          <li>
            Open your profile and go to the <strong>Activities</strong> tab.
          </li>
          <li>
            Open the activity, then open the <strong>⋯</strong> menu above its
            title.
          </li>
          <li>
            Choose to download the route, pick <strong>GPX Track</strong>, and
            confirm.
          </li>
        </ol>
      </section>

      <section aria-labelledby="custom-heading">
        <h2 id="custom-heading">A custom route</h2>
        <ol>
          <li>
            Go to <strong>Saved</strong>, then{" "}
            <strong>Custom routes &amp; maps</strong>.
          </li>
          <li>
            Open the map, then use the <strong>⋯</strong> menu to export it as a
            GPX file.
          </li>
        </ol>
      </section>

      <section aria-labelledby="trail-heading">
        <h2 id="trail-heading">A trail</h2>
        <ol>
          <li>
            On the trail&apos;s page, choose <strong>Hit the Trail</strong>.
          </li>
          <li>
            Choose <strong>Export map file</strong>, then GPX.
          </li>
        </ol>
        <p>
          Trails on AllTrails are mapped by AllTrails and its community, not by
          you, so only share one if you have permission to.
        </p>
      </section>

      <p>Some downloads need a paid AllTrails membership.</p>
    </ExportGuide>
  );
}
