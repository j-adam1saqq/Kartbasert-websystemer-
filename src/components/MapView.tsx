import { useEffect, useRef } from "react";
import "ol/ol.css";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";

import XYZ from "ol/source/XYZ";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";

import Overlay from "ol/Overlay";
import type Feature from "ol/Feature";
import { fromLonLat } from "ol/proj";

import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import CircleStyle from "ol/style/Circle";

export default function MapView() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapDivRef.current) return;

    // GeoJSON: data i lon/lat (EPSG:4326), vises i WebMercator (EPSG:3857)
    const geojsonFormat = new GeoJSON({
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });

    // ---------- Base layers ----------
    // ✅ Kartverket uten gatekeeper (mindre CORS-trøbbel)
    // Dette er en tryggere tile-url enn /gatekeeper/
    const kartverketLayer = new TileLayer({
      source: new XYZ({
        // "norgeskart" gir standard Kartverket-bakgrunn
        url: "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
        crossOrigin: "anonymous",
        attributions:
          '© <a href="https://www.kartverket.no/">Kartverket</a>',
      }),
      visible: true,
    });

    // Fallback hvis Kartverket feiler
    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: false,
    });

    // Hvis Kartverket gir feil -> slå på OSM automatisk
    kartverketLayer.getSource()?.on("tileloaderror", () => {
      kartverketLayer.setVisible(false);
      osmLayer.setVisible(true);
    });

    // ---------- BYDELER ----------
    const bydelerSource = new VectorSource({
      url: "/geojson/bydeler.geojson",
      format: geojsonFormat,
    });

    const bydelerLayer = new VectorLayer({
      source: bydelerSource,
      style: new Style({
        stroke: new Stroke({ color: "#0033cc", width: 2 }),
        fill: new Fill({ color: "rgba(0, 51, 204, 0.12)" }),
      }),
    });

    // ---------- SKOLER ----------
    const skolerSource = new VectorSource({
      url: "/geojson/skoler.geojson",
      format: geojsonFormat,
    });

    const skolerLayer = new VectorLayer({
      source: skolerSource,
      style: (feature) => {
        const studentsRaw = feature.get("antall_elever");
        const students =
          typeof studentsRaw === "number"
            ? studentsRaw
            : Number(studentsRaw ?? 0);

        const ownership = String(feature.get("eierforhold") ?? "").toLowerCase();

        // størrelse basert på elevtall
        const radius = Math.max(
          4,
          Math.min(18, Math.round(Math.sqrt(Math.max(0, students)) / 2))
        );

        // farge basert på eierforhold
        const fillColor = ownership.includes("privat")
          ? "orange"
          : ownership.includes("offentlig")
          ? "blue"
          : "red";

        return new Style({
          image: new CircleStyle({
            radius,
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: "white", width: 1 }),
          }),
        });
      },
    });

    // ---------- POPUP ----------
    const overlay = new Overlay({
      element: popupRef.current ?? undefined,
      positioning: "bottom-center",
      stopEvent: false,
      offset: [0, -10],
    });

    // ---------- MAP ----------
    const map = new Map({
      target: mapDivRef.current,
      layers: [kartverketLayer, osmLayer, bydelerLayer, skolerLayer],
      overlays: [overlay],
      view: new View({
        center: fromLonLat([10.75, 59.91]), // Oslo
        zoom: 11,
      }),
    });

    setTimeout(() => map.updateSize(), 0);

    // ---------- HOVER NAVN ----------
    map.on("pointermove", (evt) => {
      if (evt.dragging) return;

      const feature = map.forEachFeatureAtPixel(
        evt.pixel,
        (f, layer) => {
          if (layer === skolerLayer) return f;
          return undefined;
        },
        { hitTolerance: 6 }
      ) as Feature | undefined;

      if (!feature) {
        overlay.setPosition(undefined);
        map.getTargetElement().style.cursor = "";
        return;
      }

      map.getTargetElement().style.cursor = "pointer";

      const name = (feature.get("navn") as string | undefined) ?? "Skole";
      if (popupContentRef.current) popupContentRef.current.textContent = name;

      overlay.setPosition(evt.coordinate);
    });

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />

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