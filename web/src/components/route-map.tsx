"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { MultiLineString } from "geojson";
import {
  FullscreenControl,
  type GeoJSONSource,
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useEffectEvent, useRef } from "react";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const NO_LINES: MultiLineString = { type: "MultiLineString", coordinates: [] };

export type RouteMapProps = {
  path: MultiLineString;
  hiddenPath?: MultiLineString;
  isLoop: boolean;
  className?: string;
};

export function RouteMap({
  path,
  hiddenPath = NO_LINES,
  isLoop,
  className,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>(null);

  const initialBounds = useEffectEvent(() => {
    const bounds = new LngLatBounds();
    for (const line of [...path.coordinates, ...hiddenPath.coordinates]) {
      for (const [lng, lat] of line) {
        bounds.extend([lng, lat]);
      }
    }
    return bounds;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const styles = getComputedStyle(container);
    const routeColor = styles.getPropertyValue("--color-primary");
    const casingColor = styles.getPropertyValue("--color-base-100");
    const hiddenColor = styles.getPropertyValue("--color-base-content");

    setWorkerUrl(
      new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
    );
    const map = new MapLibreMap({
      container,
      style: STYLE_URL,
      bounds: initialBounds(),
      fitBoundsOptions: { padding: 48 },
      cooperativeGestures: true,
    });
    map.addControl(new NavigationControl({ showCompass: false }));
    map.addControl(new FullscreenControl());
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: NO_LINES });
      map.addSource("hidden-route", { type: "geojson", data: NO_LINES });
      map.addLayer({
        id: "hidden-route",
        type: "line",
        source: "hidden-route",
        paint: {
          "line-color": hiddenColor,
          "line-width": 3,
          "line-dasharray": [2, 1.5],
        },
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": casingColor, "line-width": 8 },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": routeColor, "line-width": 4 },
      });
    });

    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) {
      return;
    }

    const showPaths = () => {
      map.getSource<GeoJSONSource>("route")?.setData(path);
      map.getSource<GeoJSONSource>("hidden-route")?.setData(hiddenPath);
    };
    if (map.getSource("route")) {
      showPaths();
    } else {
      map.once("load", showPaths);
    }

    const styles = getComputedStyle(container);
    const points = path.coordinates.flat();
    const [startLng, startLat] = points[0];
    const markers = [
      addMarker(
        map,
        [startLng, startLat],
        styles.getPropertyValue("--color-primary"),
        "Start",
      ),
    ];
    if (!isLoop) {
      const [endLng, endLat] = points[points.length - 1];
      markers.push(addMarker(map, [endLng, endLat], styles.color, "Finish"));
    }

    return () => {
      map.off("load", showPaths);
      markers.forEach((marker) => marker.remove());
    };
  }, [path, hiddenPath, isLoop]);

  return <div ref={containerRef} className={className} />;
}

function addMarker(
  map: MapLibreMap,
  lngLat: [number, number],
  color: string,
  label: string,
) {
  const marker = new Marker({ color, scale: 0.75 }).setLngLat(lngLat);
  marker.getElement().setAttribute("aria-label", label);
  marker.getElement().title = label;
  return marker.addTo(map);
}
