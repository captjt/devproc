// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"

// https://astro.build/config
export default defineConfig({
  site: "https://captjt.github.io",
  base: "/devproc",
  integrations: [
    starlight({
      title: "DevProc",
      description: "A terminal UI application for managing your local development environment",
      social: {
        github: "https://github.com/captjt/devproc",
      },
      sidebar: [
        {
          label: "Getting Started",
          autogenerate: { directory: "getting-started" },
        },
        {
          label: "Configuration",
          autogenerate: { directory: "configuration" },
        },
        {
          label: "Usage",
          autogenerate: { directory: "usage" },
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
})
