/**
 * eventData.js — thin adapter over content.yml
 *
 * All site content lives in src/data/content.yml.
 * Edit that file; these named exports stay stable so no component import
 * paths need to change.
 */
import config from './content.yml'

export const heroStats      = config.hero.stats
export const overviewCards  = config.overview.cards
export const timelineStages = config.timeline.stages
export const navLinks       = config.nav.links
export const eventMeta      = config.event

/** Full config object — for components that need arbitrary fields */
export default config
