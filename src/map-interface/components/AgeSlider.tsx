import React, { useState, useEffect } from 'react';
import { Slider } from '@blueprintjs/core';
import { getAge, setAge } from '~/map-interface/map-page/map-view/filter-helpers';
import { setRetrieveCoasts } from '~/map-interface/map-page/map-view/map';

//This is the slider that shows up for the paleoCoast.
const AgeSlider = () => {
  const [value, setValue] = useState<number>(getAge() || 1);

  //changes the age variable.
  const handleSliderChange = (newValue: number) => {
    setValue(newValue);
    setAge(newValue);
  };

  useEffect(() => {
    setValue(getAge() || 1);
  }, []);

  //allows the query to run only when released, this prevents sending out hundreds of requests
  const handleSliderRelease = () => {
    setRetrieveCoasts(true);
  };

  return (
    <div style={{ padding: "0 20px" }}>
      <Slider
        min={0}
        max={200}
        stepSize={1}
        labelStepSize={50}
        value={value}
        onChange={handleSliderChange}
        onRelease={handleSliderRelease}
        labelRenderer={(value) => `${value}mya`}
      />
    </div>
  );
};

export default AgeSlider;