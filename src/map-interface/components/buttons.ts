import { hyperStyled } from "@macrostrat/hyper";
import { Button, ButtonProps, IconName } from "@blueprintjs/core";
import styles from "./buttons.module.styl";
import {
  useAppActions,
  useAppState,
  MapLayer,
  useHashNavigate,
} from "../app-state";
import AgeSlider from "./AgeSlider";
import React, { useState, useEffect } from 'react';

const h = hyperStyled(styles);

export const LinkButton = (props: ButtonProps & { to: string }) => {
  const { to, ...rest } = props;
  const onClick = useHashNavigate(to);
  return h(Button, {
    ...rest,
    onClick,
  });
};

type ListButtonProps = ButtonProps & {
  icon: React.ComponentType | IconName | React.ReactNode;
};

function isIconName(x: ListButtonProps["icon"]): x is IconName {
  return typeof x == "string";
}

export const ListButton = (props: ListButtonProps) => {
  let { icon, ...rest } = props;
  if (!isIconName(props.icon)) {
    icon = h(props.icon, { size: 20 });
  }
  return h(Button, { ...rest, className: "list-button", icon });
};

type LayerButtonProps = ListButtonProps & {
  layer: MapLayer;
  name: string;
  buttonComponent?: React.ComponentType<ListButtonProps>;
};

export function LayerButton(props: LayerButtonProps) {
  const { buttonComponent = ListButton, layer, name, ...rest } = props;
  const active = useAppState((state) => state.core.mapLayers.has(layer));
  const runAction = useAppActions();
  const onClick = () => runAction({ type: "toggle-map-layer", layer });
  return h(buttonComponent, {
    active,
    onClick,
    text: name,
    ...rest,
  });
}

export const PaleoLayerButton: React.FC<LayerButtonProps> = (props) => {
  const { buttonComponent = ListButton, layer, name, ...rest } = props;
  const active = useAppState((state) => state.core.mapLayers.has(layer));
  const runAction = useAppActions();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const onClick = () => {
    runAction({ type: 'toggle-map-layer', layer });
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    if (active) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  }, [active]);

  return React.createElement(
    'div',
    null,
    h(buttonComponent, {
      active,
      onClick,
      text: name,
      ...rest,
    }),
    active && isDropdownOpen
      ? React.createElement(
          'div',
          { className: 'slider-dropdown' },
          React.createElement(AgeSlider, null)
        )
      : null
  );
};
