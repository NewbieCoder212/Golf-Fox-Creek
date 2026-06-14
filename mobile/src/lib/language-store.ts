import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'fr';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
      toggleLanguage: () => set({ language: get().language === 'en' ? 'fr' : 'en' }),
    }),
    {
      name: 'fox-creek-language',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Translations for the Member Hub
export const translations = {
  en: {
    // Header
    memberHub: 'Member Hub',
    foxCreek: 'Fox Creek',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',

    // Stats
    handicap: 'Handicap',
    points: 'Points',

    // Contextual Cards
    roundInProgress: 'Round in Progress',
    currentlyOnHole: 'Currently on Hole',
    theTurn: 'The Turn',
    turnPrompt: 'Stop by the canteen for refreshments?',
    viewMenu: 'View Menu',
    noThanks: 'No Thanks',
    upcomingTeeTime: 'Upcoming Tee Time',
    startingIn: 'Starting in',
    minute: 'minute',
    minutes: 'minutes',
    minutesUntilTeeTime: 'minutes until your tee time',
    checkedIn: 'Checked In',
    readyToStart: 'Ready to start your round?',
    welcomeTo: 'Welcome to Fox Creek',
    setTeeTime: 'Set a tee time to get started',

    // Weather
    courseConditions: 'Course Conditions',
    loadingWeather: 'Loading weather...',
    weatherUnavailable: 'Weather Unavailable',

    // Tee Time Input
    setTeeTimeAlert: 'Set Tee Time Alert',
    teeTimeAlertSet: 'Tee Time Alert Set',
    enterTeeTime: 'Enter your tee time',
    setAlert: 'Set Alert',
    cancel: 'Cancel',
    clear: 'Clear',

    // Quick Links
    quickAccess: 'Quick Access',
    quickPlay: 'Quick Play',
    bookTeeTime: 'Book Tee Time',
    scorecard: 'Scorecard',
    history: 'History',
    tournaments: 'Tournaments',
    adminPortal: 'Admin Portal',

    // Pro Shop
    proShop: 'Pro Shop',
    newSeasonGear: 'New Season Gear Arrived',

    // My Events
    myEvents: 'My Events',
    viewAll: 'View All',
    event: 'Event',

    // Practice Mode
    practiceMode: 'Practice Mode',
    atRange: 'At Range',
    alertInMin: 'Alert in {minutes} min',
    teeTimePassed: 'Tee time passed',
    alertHint: "You'll be alerted 10 min before when at the range",
    setTeeTimeModalTitle: 'Set Tee Time',
    alertModalHint: "You'll be alerted 10 minutes before",

    // Announcements
    announcement: 'Announcement',
  },
  fr: {
    // Header
    memberHub: 'Espace Membre',
    foxCreek: 'Fox Creek',
    goodMorning: 'Bonjour',
    goodAfternoon: 'Bon après-midi',
    goodEvening: 'Bonsoir',

    // Stats
    handicap: 'Handicap',
    points: 'Points',

    // Contextual Cards
    roundInProgress: 'Partie en cours',
    currentlyOnHole: 'Actuellement au trou',
    theTurn: 'Mi-parcours',
    turnPrompt: 'Arrêtez-vous à la cantine pour des rafraîchissements?',
    viewMenu: 'Voir le menu',
    noThanks: 'Non merci',
    upcomingTeeTime: 'Heure de départ à venir',
    startingIn: 'Début dans',
    minute: 'minute',
    minutes: 'minutes',
    minutesUntilTeeTime: 'minutes avant votre heure de départ',
    checkedIn: 'Enregistré',
    readyToStart: 'Prêt à commencer votre partie?',
    welcomeTo: 'Bienvenue à Fox Creek',
    setTeeTime: 'Réservez une heure de départ',

    // Weather
    courseConditions: 'Conditions du parcours',
    loadingWeather: 'Chargement de la météo...',
    weatherUnavailable: 'Météo non disponible',

    // Tee Time Input
    setTeeTimeAlert: 'Définir une alerte',
    teeTimeAlertSet: 'Alerte définie',
    enterTeeTime: 'Entrez votre heure de départ',
    setAlert: 'Définir',
    cancel: 'Annuler',
    clear: 'Effacer',

    // Quick Links
    quickAccess: 'Accès rapide',
    quickPlay: 'Jeu rapide',
    bookTeeTime: 'Réserver',
    scorecard: 'Carte de score',
    history: 'Historique',
    tournaments: 'Tournois',
    adminPortal: 'Portail admin',

    // Pro Shop
    proShop: 'Boutique Pro',
    newSeasonGear: 'Nouveaux équipements disponibles',

    // My Events
    myEvents: 'Mes événements',
    viewAll: 'Tout voir',
    event: 'Événement',

    // Practice Mode
    practiceMode: 'Mode pratique',
    atRange: 'Au practice',
    alertInMin: 'Alerte dans {minutes} min',
    teeTimePassed: 'Heure de départ passée',
    alertHint: 'Alerte 10 min avant lorsque vous êtes au practice',
    setTeeTimeModalTitle: 'Définir heure de départ',
    alertModalHint: 'Alerte 10 minutes avant',

    // Announcements
    announcement: 'Annonce',
  },
} as const;

// Helper hook to get translations
export function useTranslations() {
  const language = useLanguageStore((s) => s.language);
  return translations[language];
}
