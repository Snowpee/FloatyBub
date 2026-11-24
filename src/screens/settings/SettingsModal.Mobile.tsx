import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {} from '@ionic/core';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
  IonItemGroup, IonList, IonModal, IonNav, IonTitle, IonToolbar,
} from '@ionic/react';
import { useAppStore } from '@/store';
import { chevronBack } from 'ionicons/icons';
import { X } from 'lucide-react';
import { tabs, type SettingsModalProps, type TabType } from './config';
import './ionicSetup';
import './ionic-settings.css';
import { SettingsNavigationContext, type SettingsNavigation } from './SettingsNavigationContext';

type SettingsPageProps = {
  onClose: () => void;
  onSelect: (tab: TabType) => void;
  tabId?: TabType;
};

// Keep page component identity stable: form state survives nav transitions.
function SettingsPage({ onClose, onSelect, tabId }: SettingsPageProps) {
  const tab = tabs.find((item) => item.id === tabId);
  const Section = tab?.component;

  // Model settings owns its toolbar actions and content as one standard page.
  if (tabId === 'config' && Section) return <Section />;

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            {tab ? (
              <IonBackButton defaultHref="#setting" mode="ios" text="" icon={chevronBack} aria-label="返回设置" />
            ) : (
              <IonButton onClick={onClose} aria-label="关闭设置">
                <X aria-hidden="true" size={22} />
              </IonButton>
            )}
          </IonButtons>
          <IonTitle>{tab?.name || '设置'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {Section ? (
          <Section className="min-h-full pb-8" onCloseModal={onClose} />
        ) : (
          <IonList inset className="ionic-settings-root-list">
            <IonItemGroup>
              {tabs.map(({ id, name, icon: Icon }) => (
                <IonItem key={id} button detail onClick={() => onSelect(id)}>
                  <span slot="start" className="ionic-settings-list-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <IonLabel>{name}</IonLabel>
                </IonItem>
              ))}
            </IonItemGroup>
          </IonList>
        )}
      </IonContent>
    </>
  );
}

export default function SettingsModalMobile({ isOpen, onClose, defaultTab }: SettingsModalProps) {
  const dark = useAppStore(state => state.theme === 'dark');
  const [backGuarded, setBackGuarded] = useState(false);
  const backGuard = useRef<(() => Promise<boolean>) | null>(null);
  const [presented, setPresented] = useState(false);
  const mounted = useRef(false);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const modalRef = useRef<HTMLIonModalElement>(null);
  const navRef = useRef<HTMLIonNavElement>(null);
  const close = useCallback(() => { void modalRef.current?.dismiss(); }, []);
  const back = useCallback(() => { void navRef.current?.pop(); }, []);
  const select = useCallback((tabId: TabType) => {
    void navRef.current?.push(SettingsPage, { tabId, onClose: close, onSelect: select }, { skipIfBusy: true });
  }, [close]);

  const navigation = useMemo<SettingsNavigation>(() => ({
    push: (Component, props = {}, options) => {
      // Render through JSX: legacy detail pages use React hooks.
      // IonNav's React delegate already supplies the .ion-page element.
      // A second IonPage hides headers from Ionic's direct-child navigation
      // selectors and the iOS 27 transition builder.
      const page = () => options?.layout === 'ionic' ? <Component {...props} /> : (
        <div className="ionic-settings-page ionic-settings-detail-page">
          <Component {...props} />
        </div>
      );
      void navRef.current?.push(page, undefined, { skipIfBusy: true });
    },
    pop: back,
    setBackNavigationGuard: guard => { backGuard.current = guard; setBackGuarded(!!guard); },
  }), [back]);

  const root = useCallback(() => (
    <SettingsPage onClose={close} onSelect={select} />
  ), [close, select]);

  // Also handle hash changes while the modal is already visible.
  useEffect(() => {
    if (!presented || !isOpen) return;
    const pages = [{ component: root }];
    if (defaultTab) pages.push({ component: () => (
      <SettingsPage tabId={defaultTab} onClose={close} onSelect={select} />
    ) });
    void navRef.current?.setPages(pages, { animated: false });
  }, [presented, isOpen, defaultTab, root, close, select]);

  // Ionic owns dismissal animation; synchronize the hash/parent only afterwards.
  // The keyed nav resets to the requested section when the modal is reopened.
  return (
    <IonModal
      ref={modalRef}
      className={`ionic-settings-modal${dark ? ' ion-palette-dark' : ''}`}
      aria-label="设置"
      isOpen={isOpen}
      canDismiss={() => backGuard.current ? backGuard.current() : Promise.resolve(true)}
      onDidDismiss={() => {
        if (!mounted.current) return;
        setPresented(false);
        if (openRef.current) onClose();
      }}
      onDidPresent={() => setPresented(true)}
      // Section editors still portal outside Ionic; allow focus to reach them.
      focusTrap={false}
    >
      <SettingsNavigationContext.Provider value={navigation}>
        <IonNav
          key={isOpen ? 'open' : 'closed'}
          ref={navRef}
          root={root}
          swipeGesture={!backGuarded}
        />
      </SettingsNavigationContext.Provider>
    </IonModal>
  );
}
