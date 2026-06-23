import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function canonicalLandingLinks() {
  return {
    name: 'canonical-landing-links',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.jsx?$/.test(id)) return null;
      const transformed = code.replace(/href=(["'])\/landing((?:[?#][^"']*)?)\1/g, 'href=$1/$2$1');
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}

export default defineConfig({
  plugins: [canonicalLandingLinks(), react()],
});
