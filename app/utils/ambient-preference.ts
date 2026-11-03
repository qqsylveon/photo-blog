export const AMBIENT_PREFERENCE_KEY = 'photo-journal-ambient'

// SSR decoration must honour a saved opt-out before Vue mounts.
export const ambientPreferenceBootstrap = `(function(){var on=true;try{on=localStorage.getItem('${AMBIENT_PREFERENCE_KEY}')!=='off'}catch(e){}document.documentElement.dataset.ambientEnabled=on?'on':'off'})()`
