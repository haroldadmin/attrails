"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { MultiLineString } from "geojson";
import {
  FullscreenControl,
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useRef } from "react";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export type RouteMapProps = {
  path: MultiLineString;
  isLoop: boolean;
  className?: string;
};

export function RouteMap({ path, isLoop, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const styles = getComputedStyle(container);
    const routeColor = styles.getPropertyValue("--color-primary");
    const casingColor = styles.getPropertyValue("--color-base-100");

    const points = path.coordinates.flat();
    const bounds = new LngLatBounds();
    for (const [lng, lat] of points) {
      bounds.extend([lng, lat]);
    }

    setWorkerUrl(
      new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
    );
    const map = new MapLibreMap({
      container,
      style: STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 48 },
      cooperativeGestures: true,
    });
    map.addControl(new NavigationControl({ showCompass: false }));
    map.addControl(new FullscreenControl());

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: path });
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

    const [startLng, startLat] = points[0];
    addMarker(map, [startLng, startLat], routeColor, "Start");
    if (!isLoop) {
      const [endLng, endLat] = points[points.length - 1];
      addMarker(map, [endLng, endLat], styles.color, "Finish");
    }

    return () => map.remove();
  }, [path, isLoop]);

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
  marker.addTo(map);
}
