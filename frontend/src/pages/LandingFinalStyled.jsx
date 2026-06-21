import FinalLanding, { FinalDemoTour } from './LandingFinal';
import FinalCapabilitiesPortal from './FinalCapabilitiesPortal';
import './FinalBase.css';
import './FinalFrame.css';
import './FinalScenesVisits.css';
import './FinalScenesData.css';
import './FinalMarketingAll.css';
import './FinalLandingFix.css';
import './FinalMobilePolish.css';

export function DemoTour() {
  return <FinalDemoTour />;
}

export default function Landing() {
  return <><FinalLanding /><FinalCapabilitiesPortal /></>;
}
