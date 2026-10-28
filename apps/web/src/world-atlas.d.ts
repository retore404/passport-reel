// world-atlas の JSON は TopoJSON。JSON から推論される巨大なリテラル型ではなく TopoJSON の型として扱う。
declare module "world-atlas/countries-50m.json" {
  import type { GeometryCollection, Topology } from "topojson-specification";

  const topology: Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
  export default topology;
}
