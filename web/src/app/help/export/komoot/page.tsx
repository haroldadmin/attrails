import { ExportGuide, exportGuideMetadata } from "../export-guide";

export const metadata = exportGuideMetadata("Komoot");

export default function KomootExportPage() {
  return (
    <ExportGuide
      name="Komoot"
      helpUrl="https://support.komoot.com/hc/en-us/articles/10115477099674-Export-and-import-Routes-and-Activities"
    >
      <p className="lead">
        Komoot lets you export your planned routes and completed activities as
        GPX files, from the website or the app.
      </p>

      <section aria-labelledby="website-heading">
        <h2 id="website-heading">On the website</h2>
        <ol>
          <li>On komoot.com, open the route or activity.</li>
          <li>
            Choose <strong>Export to GPS device</strong>, then download the GPX
            file.
          </li>
        </ol>
      </section>

      <section aria-labelledby="app-heading">
        <h2 id="app-heading">In the app</h2>
        <ol>
          <li>Open the route or activity.</li>
          <li>Find the export option and choose GPX.</li>
          <li>
            Save the file. It usually ends up in your Downloads folder, or you
            can search your files for <code>.gpx</code>.
          </li>
        </ol>
      </section>

      <p>
        You can only export a route if the region where it starts is unlocked in
        your Komoot account.
      </p>
    </ExportGuide>
  );
}
