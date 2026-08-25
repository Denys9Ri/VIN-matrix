import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowMobileActionDock } from '../src/utils/mobileDockVisibility.js';

test('mobile dock stays visible on visit deep links opened from push', () => {
  assert.equal(shouldShowMobileActionDock('/visits'), true);
  assert.equal(shouldShowMobileActionDock('/attention'), true);
  assert.equal(shouldShowMobileActionDock('/clients'), true);
});

test('mobile dock stays hidden on authentication and onboarding screens', () => {
  assert.equal(shouldShowMobileActionDock('/login'), false);
  assert.equal(shouldShowMobileActionDock('/register'), false);
  assert.equal(shouldShowMobileActionDock('/onboarding'), false);
  assert.equal(shouldShowMobileActionDock('/onboarding/step-2'), false);
});
