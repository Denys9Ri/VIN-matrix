import FinalLanding, { FinalDemoTour } from './LandingFinal';
import FinalCapabilitiesPortal from './FinalCapabilitiesPortal';
import FinalDemoLinkGuard from './FinalDemoLinkGuard';
import FinalMobileDemoPortal from './FinalMobileDemoPortal';
import './FinalBase.css';
import './FinalFrame.css';
import './FinalScenesVisits.css';
import './FinalScenesData.css';
import './FinalMarketingAll.css';
import './FinalLandingFix.css';
import './FinalMobilePolish.css';
import './FinalMobileDemoExtra.css';
import './FinalLogoPolish.css';

export function DemoTour() {
  return <><FinalDemoTour /><FinalMobileDemoPortal /></>;
}

export default function Landing() {
  return <><FinalLanding /><FinalCapabilitiesPortal /><FinalDemoLinkGuard /></>;
}
