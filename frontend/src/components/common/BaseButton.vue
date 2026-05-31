<script setup>
defineProps({
  /** 'primary' | 'outline' | 'ghost' */
  variant: {
    type: String,
    default: 'primary',
  },
  /** renders as <a> when href is provided */
  href: {
    type: String,
    default: null,
  },
  /** renders as <RouterLink> when to is provided */
  to: {
    type: [String, Object],
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const variantClasses = {
  primary: 'bg-neutral-950 text-white hover:bg-neutral-800 focus-visible:ring-neutral-950',
  outline: 'border-2 border-neutral-950 text-neutral-950 hover:bg-neutral-950 hover:text-white focus-visible:ring-neutral-950',
  ghost:   'text-neutral-950 underline underline-offset-2 hover:text-neutral-600 focus-visible:ring-neutral-950',
}
</script>

<template>
  <component
    :is="to ? 'RouterLink' : href ? 'a' : 'button'"
    :to="to"
    :href="href"
    :disabled="disabled || undefined"
    class="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed min-h-11"
    :class="variantClasses[variant]"
  >
    <slot />
  </component>
</template>
