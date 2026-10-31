import { describe, expect, test } from "vitest";
import {
  GPX_MAX_SIZE_BYTES,
  GpxError,
  gpxDistance,
  gpxElevation,
  gpxName,
  gpxPath,
  isGpxLoop,
  parseGpx,
  serializeGpx,
  trimGpx,
} from ".";

// One degree of latitude, in meters.
const DEGREE = 111_195;

function gpx11(body: string): string {
  return `<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;
}

function trkpt(lat: number, lon: number, ele?: number): string {
  return ele === undefined
    ? `<trkpt lat="${lat}" lon="${lon}"/>`
    : `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`;
}

function track(...segments: string[][]): string {
  return `<trk>${segments.map((points) => `<trkseg>${points.join("")}</trkseg>`).join("")}</trk>`;
}

const SEGMENT = [trkpt(51.1, 0.1), trkpt(51.2, 0.2)];

describe("parseGpx", () => {
  test("reads names, waypoints, routes, and tracks", () => {
    const gpx = parseGpx(
      gpx11(`
        <metadata><name>File</name><desc>About the file</desc></metadata>
        <wpt lat="51.5" lon="-0.1"><name>Fish &amp; <![CDATA[Chips]]></name></wpt>
        <rte><name>Route</name><rtept lat="1" lon="2"/><rtept lat="3" lon="4"/></rte>
        <trk><name>Track</name><trkseg>${trkpt(5, 6, 7)}${trkpt(8, 9)}</trkseg></trk>
      `),
    );

    expect(gpx).toEqual({
      name: "File",
      desc: "About the file",
      waypoints: [{ lat: 51.5, lon: -0.1, name: "Fish & Chips" }],
      routes: [
        {
          name: "Route",
          points: [
            { lat: 1, lon: 2 },
            { lat: 3, lon: 4 },
          ],
        },
      ],
      tracks: [
        {
          name: "Track",
          segments: [
            [
              { lat: 5, lon: 6, ele: 7 },
              { lat: 8, lon: 9 },
            ],
          ],
        },
      ],
    });
  });

  test("reads the name of a GPX 1.0 file", () => {
    const gpx = parseGpx(
      `<gpx version="1.0" xmlns="http://www.topografix.com/GPX/1/0"><name>Old</name>${track(SEGMENT)}</gpx>`,
    );

    expect(gpx.name).toBe("Old");
  });

  test("skips segments and routes with fewer than two points", () => {
    const gpx = parseGpx(
      gpx11(
        `${track([trkpt(9, 9)], SEGMENT)}<rte><rtept lat="1" lon="1"/></rte>`,
      ),
    );

    expect(gpx.tracks[0].segments).toHaveLength(1);
    expect(gpx.routes).toHaveLength(0);
  });

  test.each([
    ["isn't XML", "hello", "not-gpx"],
    ["isn't GPX", "<kml/>", "not-gpx"],
    ["only has waypoints", gpx11(`<wpt lat="1" lon="1"/>`), "no-route"],
    ["only has single-point segments", gpx11(track([trkpt(1, 1)])), "no-route"],
    [
      "has a point without a latitude",
      gpx11(track(SEGMENT, [`<trkpt lon="1"/>`])),
      "invalid-point",
    ],
    [
      "has a point with a malformed latitude",
      gpx11(track(SEGMENT, [`<trkpt lat="51.5abc" lon="1"/>`])),
      "invalid-point",
    ],
    [
      "has a point with an out-of-range latitude",
      gpx11(track(SEGMENT, [trkpt(95, 1)])),
      "invalid-point",
    ],
    [
      "has a point with a malformed elevation",
      gpx11(track(SEGMENT, [`<trkpt lat="1" lon="1"><ele>12m</ele></trkpt>`])),
      "invalid-point",
    ],
    [
      "has a waypoint with a malformed longitude",
      gpx11(`<wpt lat="1" lon="east"/>${track(SEGMENT)}`),
      "invalid-point",
    ],
  ])("rejects a file that %s", (_, text, reason) => {
    expect(() => parseGpx(text)).toThrow(GpxError);
    expect(() => parseGpx(text)).toThrow(expect.objectContaining({ reason }));
  });
});

describe("derived values", () => {
  test("measure distance without the gaps between segments", () => {
    const gpx = parseGpx(
      gpx11(track([trkpt(0, 0), trkpt(1, 0)], [trkpt(10, 0), trkpt(11, 0)])),
    );

    expect(gpxDistance(gpx)).toBeCloseTo(2 * DEGREE, -1);
  });

  test("ignore elevation changes smaller than GPS noise", () => {
    const gpx = parseGpx(
      gpx11(
        track(
          [100, 102, 105, 103, 98, 110].map((ele, index) =>
            trkpt(index / 1000, 0, ele),
          ),
        ),
      ),
    );

    expect(gpxElevation(gpx)).toEqual({ gainM: 17, lossM: 7 });
  });

  test("have no elevation for a file without any", () => {
    expect(gpxElevation(parseGpx(gpx11(track(SEGMENT))))).toBeUndefined();
  });

  test("count a path ending within 200 m of its start as a loop", () => {
    const loop = parseGpx(
      gpx11(track([trkpt(0, 0), trkpt(0.5, 0.5), trkpt(0.001, 0)])),
    );
    const line = parseGpx(gpx11(track([trkpt(0, 0), trkpt(0.01, 0)])));

    expect(isGpxLoop(loop)).toBe(true);
    expect(isGpxLoop(line)).toBe(false);
  });

  test("put tracks before routes", () => {
    const gpx = parseGpx(
      gpx11(
        `<rte><name>Route</name><rtept lat="1" lon="1"/><rtept lat="2" lon="2"/></rte>
         <trk><name>Track</name><trkseg>${SEGMENT.join("")}</trkseg></trk>`,
      ),
    );

    expect(gpxName(gpx)).toBe("Track");
    expect(gpxPath(gpx).coordinates).toEqual([
      [
        [0.1, 51.1],
        [0.2, 51.2],
      ],
      [
        [1, 1],
        [2, 2],
      ],
    ]);
  });
});

describe("trimGpx", () => {
  function meters(lat: number): number {
    return lat * DEGREE;
  }

  function line(fromM: number, toM: number): string[] {
    return [trkpt(fromM / DEGREE, 0), trkpt(toM / DEGREE, 0)];
  }

  test("cuts exactly 200 m from each end of a path", () => {
    const { gpx } = trimGpx(parseGpx(gpx11(track(line(0, 1000)))))!;

    const [points] = gpx.tracks[0].segments;
    expect(points).toHaveLength(2);
    expect(meters(points[0].lat)).toBeCloseTo(200, 1);
    expect(meters(points[1].lat)).toBeCloseTo(800, 1);
    expect(gpxDistance(gpx)).toBeCloseTo(600, 1);
  });

  test("interpolates elevation at the cuts", () => {
    const { gpx } = trimGpx(
      parseGpx(gpx11(track([trkpt(0, 0, 100), trkpt(1000 / DEGREE, 0, 200)]))),
    )!;

    const [points] = gpx.tracks[0].segments;
    expect(points[0].ele).toBeCloseTo(120);
    expect(points[1].ele).toBeCloseTo(180);
  });

  test("leaves no point from the hidden ends of a track and a route of the same path", () => {
    const route = `<rte><rtept lat="0" lon="0"/><rtept lat="${1000 / DEGREE}" lon="0"/></rte>`;
    const { gpx } = trimGpx(parseGpx(gpx11(track(line(0, 1000)) + route)))!;

    const lats = gpxPath(gpx)
      .coordinates.flat()
      .map(([, lat]) => meters(lat));
    expect(Math.min(...lats)).toBeCloseTo(200, 1);
    expect(Math.max(...lats)).toBeCloseTo(800, 1);
  });

  test("walks across segments, dropping those it covers entirely", () => {
    const { gpx } = trimGpx(
      parseGpx(gpx11(track(line(0, 150), line(1000, 1300), line(2000, 2150)))),
    )!;

    const [points] = gpx.tracks[0].segments;
    expect(gpx.tracks[0].segments).toHaveLength(1);
    expect(meters(points[0].lat)).toBeCloseTo(1050, 1);
    expect(meters(points[1].lat)).toBeCloseTo(1250, 1);
  });

  test("drops paths too short to have anything left", () => {
    const { gpx } = trimGpx(
      parseGpx(gpx11(track(line(0, 300)) + track(line(1000, 2000)))),
    )!;

    expect(gpx.tracks).toHaveLength(1);
    expect(gpxDistance(gpx)).toBeCloseTo(600, 1);
  });

  test("removes waypoints near the ends and keeps the others", () => {
    const wpt = (name: string, m: number) =>
      `<wpt lat="${m / DEGREE}" lon="0"><name>${name}</name></wpt>`;
    const { gpx } = trimGpx(
      parseGpx(
        gpx11(wpt("Home", 100) + wpt("Viewpoint", 500) + track(line(0, 1000))),
      ),
    )!;

    expect(gpx.waypoints.map(({ name }) => name)).toEqual(["Viewpoint"]);
  });

  test("reports the sections it removed", () => {
    const { removed } = trimGpx(
      parseGpx(gpx11(track(line(0, 100), line(150, 1000)))),
    )!;

    const sections = removed.coordinates.map((section) =>
      section.map(([, lat]) => Math.round(meters(lat))),
    );
    expect(sections).toEqual([
      [0, 100],
      [150, 250],
      [800, 1000],
    ]);
  });

  test("needs a route of at least 500 m", () => {
    expect(trimGpx(parseGpx(gpx11(track(line(0, 499)))))).toBeUndefined();
    expect(trimGpx(parseGpx(gpx11(track(line(0, 501)))))).toBeDefined();
  });

  test("needs something to be left", () => {
    const gpx = parseGpx(gpx11(track(line(0, 300)) + track(line(1000, 1300))));

    expect(gpxDistance(gpx)).toBeGreaterThan(500);
    expect(trimGpx(gpx)).toBeUndefined();
  });

  test("survives serializing", () => {
    const { gpx } = trimGpx(parseGpx(gpx11(track(line(0, 1000)))))!;

    expect(gpxDistance(parseGpx(serializeGpx(gpx)))).toBeCloseTo(600, 0);
  });

  test("can bring a route under the size limit", () => {
    const idle = Array.from({ length: 40_000 }, (_, index) =>
      trkpt(51 + index / 40_000_000, 1),
    );
    const gpx = parseGpx(gpx11(track([...idle, trkpt(51.1, 1)])));
    expect(new Blob([serializeGpx(gpx)]).size).toBeGreaterThan(
      GPX_MAX_SIZE_BYTES,
    );

    expect(new Blob([serializeGpx(trimGpx(gpx)!.gpx)]).size).toBeLessThan(
      GPX_MAX_SIZE_BYTES,
    );
  });
});

describe("serializeGpx", () => {
  test("keeps what ATTrails uses and drops everything else", () => {
    const text = gpx11(`
      <metadata><name>Morning ride</name><time>2026-09-13T08:00:00Z</time></metadata>
      <wpt lat="51.0" lon="-0.1"><name>Fish &amp; <![CDATA[Chips]]></name><sym>Flag</sym></wpt>
      <trk>
        <name>Loop</name>
        <type>cycling</type>
        <trkseg>
          <trkpt lat="51.123456789" lon="-0.123456789">
            <ele>12.3456789</ele>
            <time>2026-09-13T08:00:00Z</time>
            <extensions><hr>120</hr></extensions>
          </trkpt>
          <trkpt lat="51.2" lon="-0.2"/>
        </trkseg>
      </trk>
    `);

    const serialized = serializeGpx(parseGpx(text));

    expect(serialized).not.toMatch(/time|extensions|sym|type>|\n/);
    expect(parseGpx(serialized)).toEqual({
      name: "Morning ride",
      waypoints: [{ lat: 51, lon: -0.1, name: "Fish & Chips" }],
      routes: [],
      tracks: [
        {
          name: "Loop",
          segments: [
            [
              { lat: 51.123457, lon: -0.123457, ele: 12.345679 },
              { lat: 51.2, lon: -0.2 },
            ],
          ],
        },
      ],
    });
  });

  test("brings a typical oversized recording under the size limit", () => {
    const points = Array.from(
      { length: 4000 },
      (_, index) => `
        <trkpt lat="${(51 + index / 10_000).toFixed(15)}" lon="${(index / 10_000).toFixed(15)}">
          <ele>${(50 + (index % 100) / 3).toFixed(6)}</ele>
          <time>2026-09-13T08:00:00Z</time>
          <extensions>
            <gpxtpx:TrackPointExtension>
              <gpxtpx:hr>120</gpxtpx:hr>
              <gpxtpx:cad>85</gpxtpx:cad>
            </gpxtpx:TrackPointExtension>
          </extensions>
        </trkpt>`,
    );
    const text = gpx11(track(points));
    expect(new Blob([text]).size).toBeGreaterThan(GPX_MAX_SIZE_BYTES);

    const gpx = parseGpx(text);
    const serialized = serializeGpx(gpx);

    expect(new Blob([serialized]).size).toBeLessThan(GPX_MAX_SIZE_BYTES);
    expect(gpxDistance(parseGpx(serialized))).toBeCloseTo(gpxDistance(gpx), 0);
  });
});
