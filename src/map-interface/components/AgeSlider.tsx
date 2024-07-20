import React, { useState, useEffect } from 'react';
import { useAppActions } from "~/map-interface/app-state";
import { Slider } from '@blueprintjs/core';
import { getAge, setAge } from '~/map-interface/map-page/map-view/filter-helpers';

const AgeSlider = () => {
  const runAction = useAppActions();
  const [value, setValue] = useState<number>(getAge() || 1);

  const handleSliderChange = (newValue: number) => {
    setValue(newValue);
    setAge(newValue);
  };

  useEffect(() => {
    setValue(getAge() || 1);
  }, []);

  const handleSliderRelease = () => {
    runAction({ type: 'get-paleo-coast' });
  };

  return (
    <Slider
      min={0}
      max={200}
      stepSize={1}
      labelStepSize={50}
      value={value}
      onChange={handleSliderChange}
      onRelease={handleSliderRelease}
      labelRenderer={(value) => `${value}`}
    />
  );
};

export default AgeSlider;