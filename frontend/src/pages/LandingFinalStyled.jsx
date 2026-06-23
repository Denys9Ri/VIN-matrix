import FinalLanding, { FinalDemoTour } from './LandingFinal';
import FinalCapabilitiesPortal from './FinalCapabilitiesPortal';
import FinalDemoLinkGuard from './FinalDemoLinkGuard';
import FinalMobileDemoPortal from './FinalMobileDemoPortal';
import FinalMobileHeroPreviewPortal from './FinalMobileHeroPreviewPortal';
import LandingSearchContentPortal from './LandingSearchContent';
import LandingTestimonialsPortal from './LandingTestimonialsPortal';
import PublicSeo from './PublicSeo';
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
  return <><PublicSeo /><FinalDemoTour /><FinalMobileDemoPortal /></>;
}

export default function Landing() {
  return <><PublicSeo /><FinalLanding /><FinalCapabilitiesPortal /><LandingSearchContentPortal /><LandingTestimonialsPortal /><FinalDemoLinkGuard /><FinalMobileHeroPreviewPortal /></>;
}
