import { AMBIENT_PREFERENCE_KEY } from '~/utils/ambient-preference'

export const useAmbientPreference = () => {
  const enabled = useState('ambient-enabled', () => true)
  const syncHint = () => { document.documentElement.dataset.ambientEnabled = enabled.value ? 'on' : 'off' }
  onMounted(() => {
    try { const stored = localStorage.getItem(AMBIENT_PREFERENCE_KEY); if (stored !== null) enabled.value = stored !== 'off' } catch {}
    syncHint()
  })
  function toggle() {
    enabled.value = !enabled.value
    syncHint()
    try { localStorage.setItem(AMBIENT_PREFERENCE_KEY, enabled.value ? 'on' : 'off') } catch {}
  }
  return { enabled, toggle }
}
