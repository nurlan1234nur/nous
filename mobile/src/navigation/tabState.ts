// MainTabs theme солигдоход дахин mount болдог тул идэвхтэй табыг component-оос гадна хадгална.
// Logout үед цэвэрлэнэ — эс бөгөөс дараагийн хэрэглэгч өмнөхийн сүүлд нээсэн табаар эхэлнэ.
export type TabKey = 'home' | 'timeline' | 'memories' | 'chat' | 'more';

let lastTab: TabKey = 'home';

export function getLastTab(): TabKey {
  return lastTab;
}

export function setLastTab(tab: TabKey): void {
  lastTab = tab;
}

export function resetLastTab(): void {
  lastTab = 'home';
}
