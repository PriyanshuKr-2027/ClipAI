import { Composition, registerRoot } from 'remotion';
import NeonPop from './compositions/NeonPop.jsx';
import HinglishFire from './compositions/HinglishFire.jsx';
import BoldDevanagari from './compositions/BoldDevanagari.jsx';
import CleanMinimal from './compositions/CleanMinimal.jsx';
import ReelBold from './compositions/ReelBold.jsx';

export const RemotionRoot = () => {
  const commonProps = {
    durationInFrames: 1800, // 60s at 30fps
    fps: 30,
    width: 1080,
    height: 1920,
    defaultProps: {
      words: [],
      videoWidth: 1080,
      videoHeight: 1920,
    },
  };

  return (
    <>
      <Composition
        id="NeonPop"
        component={NeonPop}
        {...commonProps}
      />
      <Composition
        id="HinglishFire"
        component={HinglishFire}
        {...commonProps}
      />
      <Composition
        id="BoldDevanagari"
        component={BoldDevanagari}
        {...commonProps}
      />
      <Composition
        id="CleanMinimal"
        component={CleanMinimal}
        {...commonProps}
      />
      <Composition
        id="ReelBold"
        component={ReelBold}
        {...commonProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
