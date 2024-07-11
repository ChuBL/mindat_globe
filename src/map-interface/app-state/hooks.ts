import { AppAction } from "./reducers";
import actionRunner from "./handlers";
import { useStore, useSelector, useDispatch } from "react-redux";
import { AppState } from ".";
import React from "react";
import { useEffect } from "react";

import axios from 'axios';

function useActionDispatch() {
  return useDispatch<React.Dispatch<AppAction>>();
}

function useAppActions(): (action: AppAction) => Promise<void> {
  const dispatch = useActionDispatch();
  const store = useStore<AppState, AppAction>();
  return async (action) => {
    const appState = store.getState();
    //This try catch prevents crashes when using the search bar
    //This happens because of improper handling of the cancel object
    //It may be usefull in the future to try to find the root of this issue but for now
    //this band aid works. 
    try {
      const newAction = await actionRunner(appState, action, dispatch);
      if (newAction == undefined || newAction == null) return;
      dispatch(newAction as AppAction);
    } catch (error) {
      console.error('Error in actionRunner:', error);
      // Handle the cancel error specifically if it is from Axios or a similar library
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
      } 
    }
  };
}

function useFilterState() {
  const { filters, filtersOpen } = useSelector((state) => state.core);
  return { filters, filtersOpen };
}

function useSearchState() {
  const { searchResults, isSearching, term, inputFocus, infoDrawerOpen } =
    useSelector((state) => state.core);
  return { searchResults, isSearching, term, inputFocus, infoDrawerOpen };
}

function useMenuState() {
  const { menuOpen, infoDrawerOpen } = useSelector((state) => state.core);
  const menu = useSelector((state) => state.menu);
  return { menuOpen, infoDrawerOpen, ...menu };
}

function useAppState<T>(selectorFn: (state: AppState) => T): T {
  return useSelector<AppState>(selectorFn) as T;
}

interface OutsideClickI {
  ref: React.RefObject<HTMLElement>;
  fn: (event: Event) => void;
}

function useOutsideClick(props: OutsideClickI) {
  const { ref, fn } = props;

  useEffect(() => {
    function handleOutsideClick(event) {
      if (ref.current && !ref.current?.contains(event.target)) {
        return fn(event);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [ref]);
}

export {
  useAppActions,
  useFilterState,
  useSearchState,
  useMenuState,
  useAppState,
  useOutsideClick,
};
