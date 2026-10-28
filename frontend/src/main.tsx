import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { store, bootstrapSession } from './store';
import App from './App';
import { AppearanceProvider } from './theme';
import './styles.css';
import './layout.css';
import './responsive.css';
import './dragonfly.css';

void bootstrapSession();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Provider store={store}><AppearanceProvider><HashRouter><App/></HashRouter></AppearanceProvider></Provider></React.StrictMode>);

