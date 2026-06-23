import FinalLanding, { FinalDemoTour } from './LandingFinal';
import FinalCapabilitiesPortal from './FinalCapabilitiesPortal';
import FinalDemoLinkGuard from './FinalDemoLinkGuard';
import FinalLoginButtonPortal from './FinalLoginButtonPortal';
import FinalMobileDemoPortal from './FinalMobileDemoPortal';
import FinalMobileHeroPreviewPortal from './FinalMobileHeroPreviewPortal';
import LandingSearchContentPortal from './LandingSearchContent';
import LandingTestimonialsPortal from './LandingTestimonialsPortal';
import './FinalBase.css';
import './FinalFrame.css';
import './FinalScenesVisits.css';
import './FinalScenesData.css';
import './FinalMarketingAll.css';
import './FinalLandingFix.css';
import './FinalMobilePolish.css';
import './FinalMobileDemoExtra.css';
import './FinalLogoPolish.css';
import './FinalMobileHeroFloat.css';

export function DemoTour() {
  return <><FinalDemoTour /><FinalMobileDemoPortal /></>;
}

export default function Landing() {
  return <><FinalLanding /><FinalCapabilitiesPortal /><LandingSearchContentPortal /><LandingTestimonialsPortal /><FinalDemoLinkGuard /><FinalLoginButtonPortal /><FinalMobileHeroPreviewPortal /></>;
}
