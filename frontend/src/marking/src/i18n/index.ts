import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
const i18n = createInstance();
void i18n.use(initReactI18next).init({ resources: { ru: { translation: ru }, en: { translation: en } }, lng: 'ru', fallbackLng: 'ru', interpolation: { escapeValue: false } });
export default i18n;
