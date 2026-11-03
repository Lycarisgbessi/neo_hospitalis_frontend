import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// NOTE : les variables VITE_* (ex: VITE_GEMINI_API_KEY) sont chargées
// automatiquement depuis .env / .env.[mode] et lues via import.meta.env.
export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendors stables (mis en cache longtemps par le navigateur)
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion', 'motion'],
            'vendor-ai':    ['@google/generative-ai'],
            'vendor-ui':    ['lucide-react', 'clsx', 'tailwind-merge'],
            // Pages lourdes isolées pour chargement à la demande
            'page-gyneco':    ['./src/pages/GynecoPage.tsx'],
            'page-pediatrie': ['./src/pages/PediatriePage.tsx'],
            'page-doctor':    ['./src/pages/DoctorPage.tsx'],
            'page-reception': ['./src/pages/ReceptionPage.tsx'],
            'page-cashier':   ['./src/pages/CashierPage.tsx'],
            'page-lab':       ['./src/pages/LabPage.tsx'],
            'page-imagerie':  ['./src/pages/ImageriePage.tsx'],
          },
        },
      },
    },
  };
});
