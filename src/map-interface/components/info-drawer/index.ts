import { Card } from "@blueprintjs/core";
import hyper from "@macrostrat/hyper";
import { MapLayer, useAppActions } from "~/map-interface/app-state";
import { InfoDrawerHeader } from "./header";
import { FossilCollections } from "./fossil-collections";
import { MindatCollections } from "./mindat-panel";
import { PaleoSlider } from "./PaleoSlider";
import { GeologicMapInfo } from "./geo-map";
import { MacrostratLinkedData } from "./macrostrat-linked";
import { RegionalStratigraphy } from "./reg-strat";
import { Physiography } from "./physiography";
import { XddExpansion } from "./xdd-panel";
import { useAppState } from "~/map-interface/app-state";
import classNames from "classnames";
import styles from "./main.module.styl";
import { LoadingArea } from "../transitions";
import { ErrorBoundary } from "@macrostrat/ui-components";
import { useCallback } from "react";

const h = hyper.styled(styles);

function InfoDrawerContainer(props) {
  return h(Card, { className: "infodrawer", ...props });
}

function InfoDrawer(props) {
  // We used to enable panels when certain layers were on,
  // but now we just show all panels always
  let { className } = props;
  const mapInfo = useAppState((state) => state.core.mapInfo);
  const fetchingMapInfo = useAppState((state) => state.core.fetchingMapInfo);

  const runAction = useAppActions();

  className = classNames("infodrawer", className, {
    loading: fetchingMapInfo,
  });

  const onCloseClick = useCallback(
    () => runAction({ type: "close-infodrawer" }),
    [runAction]
  );

  return h(Card, { className }, [
    h(InfoDrawerHeader, {
      mapInfo,
      onCloseClick,
    }),
    h("div.infodrawer-body", [
      h(ErrorBoundary, [
        h(
          LoadingArea,
          { loaded: !fetchingMapInfo },
          h.if(!fetchingMapInfo)(InfoDrawerInterior)
        ),
      ]),
    ]),
  ]);
}

function InfoDrawerInterior(props) {
  const { mapInfo, columnInfo, pbdbData, mapLayers, mindatPointData } = useAppState(
    (state) => state.core
  );

  const stratigraphyShown = mapLayers.has(MapLayer.COLUMNS);

  if (!mapInfo || !mapInfo.mapData) {
    return null;
  }

  const { mapData } = mapInfo;

  let source =
    mapInfo && mapInfo.mapData && mapInfo.mapData.length
      ? mapInfo.mapData[0]
      : {
          name: null,
          descrip: null,
          comments: null,
          liths: [],
          b_int: {},
          t_int: {},
          ref: {},
        };

  return h("div", [
    h(GeologicMapInfo, {
      mapInfo,
      bedrockExpanded: true,
      source,
    }),
    h.if(stratigraphyShown)(RegionalStratigraphy, {
      mapInfo,
      columnInfo,
    }),
    h(FossilCollections, { data: pbdbData, expanded: true }),
    h(MindatCollections, { data: mindatPointData, expanded: true}),
    h(MacrostratLinkedData, {
      mapInfo,
      bedrockMatchExpanded: true,
      source,
    }),
    h.if(mapData[0] && mapData[0].strat_name.length)(XddExpansion),
    h(Physiography, { mapInfo }),
  ]);
}

export default InfoDrawer;
export { InfoDrawerContainer };
