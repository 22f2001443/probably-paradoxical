import { defineStore } from 'pinia'
import { ref } from 'vue'
import { timelineStages, overviewCards } from '../data/eventData.js'

export const useEventStore = defineStore('event', () => {
  const stages = ref(timelineStages)
  const cards  = ref(overviewCards)
  const teams  = ref([])

  function setTeams(data) {
    teams.value = data
  }

  return { stages, cards, teams, setTeams }
})
