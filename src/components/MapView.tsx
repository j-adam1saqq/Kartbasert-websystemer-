import { useEffect, useRef } from "react";
import "ol/ol.css";

import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";

import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";

import { useGeographic } from "ol/proj";

import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";

import Overlay from "ol/Overlay";
import type Feature from "ol/Feature";

useGeographic();

export default function MapView() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapDivRef.current) return;

    // Vector layer (GeoJSON)
    const fylkerLayer = new VectorLayer({
      source: new VectorSource({
        url: "/geojson/fylker.json",
        format: new GeoJSON(),
      }),
      style: new Style({
        stroke: new Stroke({ color: "#0033cc", width: 3 }),
        fill: new Fill({ color: "rgba(0, 51, 204, 0.25)" }),
      }),
    });

    // Popup overlay
    const overlay = new Overlay({
      element: popupRef.current ?? undefined,
      positioning: "bottom-center",
      offset: [0, -10],
      stopEvent: false,
    });

    // Map
    const map = new OlMap({
      target: mapDivRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        fylkerLayer,
      ],
      overlays: [overlay],
      view: new View({
        center: [10.75, 59.91], // Oslo-ish
        zoom: 8,
      }),
    });

    // Viktig i React
    setTimeout(() => map.updateSize(), 0);

    // Klikk-håndtering
    map.on("singleclick", (evt) => {
      const feature = map.forEachFeatureAtPixel(
        evt.pixel,
        (f) => f
      ) as Feature | undefined;

      let tekst = "Du klikket på kartet";

      if (feature) {
        tekst =
          (feature.get("navn") as string | undefined) ??
          (feature.get("NAME") as string | undefined) ??
          (feature.get("name") as string | undefined) ??
          tekst;
      }

      if (popupContentRef.current) {
        popupContentRef.current.textContent = tekst;
      }

      overlay.setPosition(evt.coordinate);
    });

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={mapDivRef}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Popup */}
      <div
        ref={popupRef}
        style={{
          position: "absolute",
          background: "white",
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid rgba(0,0,0,0.2)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          fontSize: "14px",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <div ref={popupContentRef}></div>
      </div>
    </div>
  );
}
