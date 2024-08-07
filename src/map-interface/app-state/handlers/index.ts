import {
  fetchFilteredColumns,
  fetchPaleoCoast,
  handleXDDQuery,
  runColumnQuery,
  runMapQuery,
  asyncGetElevation,
  getPBDBData,
  getMindatPoint,
  base,
  fetchAllColumns,
  fetchAllCoasts,
} from "./fetch";
import { AppAction, AppState } from "../reducers";
import axios from "axios";
import { runFilter } from "./filters";
import { push } from "@lagunovsky/redux-react-router";
import { routerBasename } from "~/map-interface/settings";
import { isDetailPanelRoute } from "../nav-hooks";
import { MenuPage, setInfoMarkerPosition } from "../reducers";
import { formatCoordForZoomLevel } from "~/map-interface/utils/formatting";
import { currentPageForPathName } from "../nav-hooks";
import { getInitialStateFromHash } from "../reducers/hash-string";
import {
  findColumnForLocation,
  ColumnProperties,
  ColumnGeoJSONRecord,
} from "./columns";
import { MapLayer } from "../reducers/core";
import { getAge } from "~/map-interface/map-page/map-view/filter-helpers";

async function actionRunner(
  state: AppState,
  action: AppAction,
  dispatch = null
): Promise<AppAction | void> {
  const age = 50;
  const coreState = state.core;
  switch (action.type) {
    case "get-initial-map-state": {
      const { pathname } = state.router.location;
      let s1 = setInfoMarkerPosition(state);
      let coreState = s1.core;

      const activePage = currentPageForPathName(pathname);

      // Harvest as much information as possible from the hash string
      let [coreState1, filters] = getInitialStateFromHash(
        coreState,
        state.router.location.hash
      );

      // Fill out the remainder with defaults

      // We always get all columns on initial load, which might be
      // a bit unnecessary
      let columns: ColumnGeoJSONRecord[] | null = null;
      if (coreState1.mapLayers.has(MapLayer.COLUMNS)) {
        columns = await fetchAllColumns();
      }

      dispatch({
        type: "replace-state",
        state: {
          ...state,
          core: {
            ...coreState1,
            allColumns: columns,
            initialLoadComplete: true,
          },
          menu: { activePage },
        },
      });

      // Apply all filters in parallel
      const newFilters = await Promise.all(
        filters.map((f) => {
          return runFilter(f);
        })
      );
      await dispatch({ type: "set-filters", filters: newFilters });

      // Then reload the map by faking a layer change event.
      // There is probably a better way to do this.
      return {
        type: "map-layers-changed",
        mapLayers: coreState1.mapLayers,
      };
    }
    case "map-layers-changed": {
      const age = getAge();
      const { mapLayers } = action;
      if (mapLayers.has(MapLayer.COLUMNS) && state.core.allColumns == null) {
        const columns = await fetchAllColumns();
        return { type: "set-all-columns", columns };
      } else if (mapLayers.has(MapLayer.PALEOCOAST) && state.core.allCoasts == null) {
        const coasts = await fetchAllCoasts(age);
        return { type: "set-all-coasts", coasts };
      } else {
        return null;
      }
    }
    case "toggle-menu": {
      // Push the menu onto the history stack
      let activePage = state.menu.activePage;
      // If input is focused we want to open the menu if clicked, not run the toggle action.
      if (activePage != null && !state.core.inputFocus) {
        activePage = null;
      } else {
        activePage = MenuPage.LAYERS;
      }
      return await actionRunner(
        state,
        { type: "set-menu-page", page: activePage },
        dispatch
      );
    }
    case "go-to-experiments-panel": {
      await dispatch({ type: "toggle-experiments-panel", open: true });
      return await actionRunner(
        state,
        { type: "set-menu-page", page: MenuPage.SETTINGS },
        dispatch
      );
    }
    case "set-menu-page": {
      const { pathname } = state.router.location;
      if (!isDetailPanelRoute(pathname)) {
        const newPathname = routerBasename + (action.page ?? "");
        await dispatch(push({ pathname: newPathname, hash: location.hash }));
      }
      return { type: "set-menu-page", page: action.page };
    }
    case "close-infodrawer":
      const pathname = routerBasename + (state.menu.activePage ?? "");
      await dispatch(push({ pathname, hash: location.hash }));
      return action;
    case "fetch-search-query":
      const { term } = action;
      let CancelToken = axios.CancelToken;
      let source = CancelToken.source();
      dispatch({
        type: "start-search-query",
        term,
        cancelToken: source,
      });
      const res = await axios.get(base + "/mobile/autocomplete", {
        params: {
          include: "interval,lithology,environ,strat_name",
          query: term,
        },
        cancelToken: source.token,
        responseType: "json",
      });
      return { type: "received-search-query", data: res.data.success.data };
    case "fetch-xdd":
      const { mapInfo } = coreState;
      let CancelToken1 = axios.CancelToken;
      let source1 = CancelToken1.source();
      dispatch({
        type: "start-xdd-query",
        cancelToken: source1,
      });
      const gdd_data = await handleXDDQuery(mapInfo, source1.token);
      return { type: "received-xdd-query", data: gdd_data };
    case "select-search-result":
      const { result } = action;
      if (result.type == "place") {
        return { type: "go-to-place", place: result };
      } else {
        return {
          type: "add-filter",
          filter: await runFilter(result),
        };
      }
    case "async-add-filter":
      return { type: "add-filter", filter: await runFilter(action.filter) };
    case "get-filtered-columns":
      return {
        type: "update-column-filters",
        columns: await fetchFilteredColumns(coreState.filters),
      };
    case "get-paleo-coast":
      const age = getAge();
      return {
        type: "update-paleo-coast",
        paleoCoast: await fetchPaleoCoast(age),
      };
    case "map-query": {
      const { lng, lat, z } = action;
      const ln = formatCoordForZoomLevel(lng, Number(z));
      const lt = formatCoordForZoomLevel(lat, Number(z));
      return push({
        pathname: routerBasename + `loc/${ln}/${lt}`,
        hash: location.hash,
      });
      //return { ...action, type: "run-map-query" };
    }
    case "run-map-query":
      const { lng, lat, z, map_id } = action;
      // Get column data from the map action if it is provided.
      // This saves us from having to filter the columns more inefficiently
      let { column } = action;
      let CancelTokenMapQuery = axios.CancelToken;
      let sourceMapQuery = CancelTokenMapQuery.source();
      if (coreState.inputFocus && coreState.contextPanelOpen) {
        // Dismiss the current context panel
        return { type: "context-outside-click" };
      }

      dispatch({
        type: "start-map-query",
        lng,
        lat,
        cancelToken: sourceMapQuery,
      });
      let mapData = await runMapQuery(
        lng,
        lat,
        z,
        map_id,
        sourceMapQuery.token
      );

      if (
        column == null &&
        state.core.allColumns != null &&
        state.core.mapLayers.has(MapLayer.COLUMNS)
      ) {
        column = findColumnForLocation(state.core.allColumns, {
          lng,
          lat,
        })?.properties;
      }

      const { columnInfo } = state.core;
      if (column != null && columnInfo?.col_id != column.col_id) {
        // Get the column units if we don't have them already
        actionRunner(
          state,
          { type: "get-column-units", column },
          dispatch
        ).then(dispatch);
      }

      coreState.infoMarkerPosition = { lng, lat };
      return {
        type: "received-map-query",
        data: mapData,
      };
    case "get-column-units":
      let CancelTokenGetColumn = axios.CancelToken;
      let sourceGetColumn = CancelTokenGetColumn.source();
      dispatch({ type: "start-column-query", cancelToken: sourceMapQuery });

      let columnData = await runColumnQuery(
        action.column,
        sourceGetColumn.token
      );
      return {
        type: "received-column-query",
        data: columnData,
        column: action.column,
      };
    case "get-elevation":
      let CancelTokenElevation = axios.CancelToken;
      let sourceElevation = CancelTokenElevation.source();
      dispatch({
        type: "start-elevation-query",
        cancelToken: sourceElevation.token,
      });
      const elevationData = await asyncGetElevation(
        action.line,
        sourceElevation
      );
      return {
        type: "received-elevation-query",
        data: elevationData,
      };
    case "get-pbdb":
      let collection_nos = action.collection_nos;
      dispatch({ type: "start-pbdb-query" });
      return {
        type: "received-pbdb-query",
        data: await getPBDBData(collection_nos),
      };
    case "get-mindat":
      let id = action.id
      return {
        type: "get-mindatPoint-data",
        data: await getMindatPoint(id),
      }
    default:
      return action;
  }
}

export default actionRunner;
