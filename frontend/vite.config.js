import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import jsYaml from 'js-yaml'

/**
 * Inline Vite plugin: transforms .yml / .yaml files into ES module default exports.
 * Any component can do: import config from '../data/content.yml'
 * Editing content.yml triggers HMR — no code changes needed.
 */
function yamlPlugin() {
  return {
    name: 'vite-plugin-yaml',
    transform(src, id) {
      if (/\.(ya?ml)$/.test(id)) {
        const data = jsYaml.load(src)
        return {
          code: `export default ${JSON.stringify(data)}`,
          map: null,
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [
    yamlPlugin(),
    tailwindcss(),
    vue(),
  ],
})
