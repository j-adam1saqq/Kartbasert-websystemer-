import "ol/ol.css";
import { useEffect, useRef } from "react";

import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat, get as getProjection } from "ol/proj";
import { getTopLeft } from "ol/extent";

import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";

import VectorSource from "ol/source/Vector";
import WMTS from "ol/source/WMTS";

import GeoJSON from "ol/format/GeoJSON";

import Overlay from "ol/Overlay";
import WMTSTileGrid from "ol/tilegrid/WMTS";

import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";

import type { FeatureLike } from "ol/Feature";
import type { StyleFunction } from "ol/style/Style";
import type Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";

function createKartverketWmtsSource(): WMTS {
  const projection = getProjection("EPSG:3857");
  if (!projection) throw new Error("Projection not found");

  const extent = projection.getExtent();
  const tileSize = 256;
  const maxZoom = 18;

  const width = extent[2] - extent[0];
  const startResolution = width / tileSize;

  const resolutions: number[] = [];
  const matrixIds: string[] = [];
  for (let z = 0; z <= maxZoom; z++) {
    resolutions[z] = startResolution / Math.pow(2, z);
    matrixIds[z] = String(z);
  }

  const tileGrid = new WMTSTileGrid({
    origin: getTopLeft(extent),
    resolutions,
    matrixIds,
    tileSize,
  });

  return new WMTS({
    url: "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/3857/{TileMatrix}/{TileRow}/{TileCol}.png",
    layer: "topo",
    matrixSet: "3857",
    format: "image/png",
    projection,
    tileGrid,
    style: "default",
    wrapX: true,
    crossOrigin: "anonymous",
  });
}

type SchoolProps = {
  navn?: string;
  antall_elever?: number;
  eierforhold?: string;
};

export default function MapView() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapDivRef.current) return;

    const geojson = new GeoJSON({
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });

    const bydelerSource = new VectorSource({
      url: `${import.meta.env.BASE_URL}geojson/bydeler.geojson`,
      format: geojson,
    });

    const skolerSource = new VectorSource({
      url: `${import.meta.env.BASE_URL}geojson/skoler.geojson`,
      format: geojson,
    });

    const bakgrunnLayer = new TileLayer({
      source: createKartverketWmtsSource(),
    });

    const bydelerLayer = new VectorLayer({
      source: bydelerSource,
      style: new Style({
        stroke: new Stroke({ color: "#0b3d91", width: 2 }),
        fill: new Fill({ color: "rgba(11, 61, 145, 0.15)" }),
      }),
    });

    const schoolStyle: StyleFunction = (feature: FeatureLike) => {
      const f = feature as Feature<Geometry>;
      const props = f.getProperties() as SchoolProps;

      const eleverRaw = props.antall_elever ?? 0;
      const elever = Number.isFinite(eleverRaw) ? Number(eleverRaw) : 0;

      const radius = Math.max(4, Math.min(22, Math.sqrt(elever) * 0.9));
      const eier = (props.eierforhold ?? "").toLowerCase();
      const isPrivat = eier.includes("privat");

      const fillColor = isPrivat
        ? "rgba(255,165,0,0.9)"
        : "rgba(0,140,255,0.9)";

      return new Style({
        image: new CircleStyle({
          radius,
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: "rgba(255,255,255,0.95)", width: 2 }),
        }),
      });
    };

    const skolerLayer = new VectorLayer({
      source: skolerSource,
      style: schoolStyle,
    });

    const overlay = new Overlay({
      element: popupRef.current ?? undefined,
      positioning: "bottom-center",
      offset: [0, -12],
      stopEvent: false,
    });

    const map = new Map({
      target: mapDivRef.current,
      layers: [bakgrunnLayer, bydelerLayer, skolerLayer],
      overlays: [overlay],
      view: new View({
        center: fromLonLat([10.75, 59.91]),
        zoom: 5,
        minZoom: 4,
      }),
    });

    setTimeout(() => map.updateSize(), 0);

    bydelerSource.once("change", () => {
      if (bydelerSource.getState() === "ready") {
        const extent = bydelerSource.getExtent();
        if (extent && extent[0] !== Infinity) {
          map.getView().fit(extent, {
            padding: [40, 40, 40, 40],
            maxZoom: 12,
          });
        }
      }
    });

    map.on("pointermove", (evt) => {
      if (!popupContentRef.current) return;

      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f as Feature<Geometry>);
      if (!feature) {
        overlay.setPosition(undefined);
        return;
      }

      const props = feature.getProperties() as SchoolProps;
      if (!props?.navn) {
        overlay.setPosition(undefined);
        return;
      }

      popupContentRef.current.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;">${props.navn}</div>
        <div style="font-size:12px;opacity:0.85;">
          Elever: ${props.antall_elever ?? "?"} • Eier: ${props.eierforhold ?? "?"}
        </div>
      `;

      overlay.setPosition(evt.coordinate);
    });

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
      <div
        ref={popupRef}
        style={{
          position: "absolute",
          background: "white",
          padding: "8px 10px",
          borderRadius: "8px",
          border: "1px solid rgba(0,0,0,0.2)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          fontSize: "14px",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <div ref={popupContentRef} />
      </div>
    </div>
  );
}